import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { calcLineItem, calcInvoiceTotals, isInterState } from "@/server/services/gst";
import { generateInvoiceNumber, generateBosNumber } from "@/server/services/invoice-number";
import { generateInvoicePdf, type PdfLineItem } from "@/server/services/pdf-invoice";
import { INDIAN_STATES } from "@/lib/constants";

/** Compute invoice status from balance + due date (skips draft/cancelled) */
function computeInvoiceStatus(invoice: { status: string; balanceDue: number | { toNumber(): number }; dueDate: Date | string }): string {
  const { status } = invoice;
  if (status === "draft" || status === "cancelled") return status;
  const balance = typeof invoice.balanceDue === "number" ? invoice.balanceDue : invoice.balanceDue.toNumber();
  if (balance <= 0) return "paid";
  const due = new Date(invoice.dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < now) return "overdue";
  if (status === "partially_paid") return "partially_paid";
  return status;
}

const lineItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  quantity: z.number().min(0),
  unit: z.string().default("nos"),
  rate: z.number().min(0),
  gstRate: z.number().min(0).max(28),
  discountType: z.enum(["percentage", "fixed"]).optional().nullable(),
  discountValue: z.number().optional().nullable(),
  sortOrder: z.number().default(0),
});

export const invoiceRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        invoiceType: z.enum(["invoice", "bill_of_supply"]).optional(),
        status: z.string().optional(),
        customerId: z.string().optional(),
        search: z.string().optional(),
        showDeleted: z.boolean().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z.enum(["invoiceNumber", "customerName", "invoiceDate"]).default("invoiceNumber"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      };
      if (input.invoiceType) {
        where.invoiceType = input.invoiceType;
      }
      if (input.showDeleted) {
        where.deletedAt = { not: null };
      } else {
        where.deletedAt = null;
      }
      if (input.status) where.status = input.status;
      if (input.customerId) where.customerId = input.customerId;
      if (input.search) {
        where.OR = [
          { invoiceNumber: { contains: input.search, mode: "insensitive" } },
          { customer: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }
      if (input.dateFrom || input.dateTo) {
        const dateFilter: Record<string, Date> = {};
        if (input.dateFrom) dateFilter.gte = new Date(input.dateFrom);
        if (input.dateTo) dateFilter.lte = new Date(input.dateTo + "T23:59:59");
        where.invoiceDate = dateFilter;
      }

      const skip = (input.page - 1) * input.pageSize;

      // Build orderBy based on sortBy param
      let orderBy: Record<string, unknown>;
      if (input.sortBy === "customerName") {
        orderBy = { customer: { name: input.sortOrder } };
      } else if (input.sortBy === "invoiceDate") {
        orderBy = { invoiceDate: input.sortOrder };
      } else {
        orderBy = { invoiceNumber: input.sortOrder };
      }

      const [invoices, totalCount] = await Promise.all([
        ctx.db.invoice.findMany({
          where: where as never,
          include: {
            customer: { select: { id: true, name: true } },
          },
          orderBy: orderBy as never,
          skip,
          take: input.pageSize,
        }),
        ctx.db.invoice.count({ where: where as never }),
      ]);

      // Auto-compute status for non-deleted invoices
      if (!input.showDeleted) {
        const updates: Promise<unknown>[] = [];
        for (const inv of invoices) {
          const computed = computeInvoiceStatus(inv);
          if (computed !== inv.status) {
            inv.status = computed;
            updates.push(
              ctx.db.invoice.update({
                where: { id: inv.id },
                data: { status: computed },
              })
            );
          }
        }
        if (updates.length > 0) {
          try { await Promise.all(updates); } catch (e) { console.error("Status sync error:", e); }
        }
      }

      return {
        invoices,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize),
        page: input.page,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          customer: true,
          lines: { orderBy: { sortOrder: "asc" } },
          payments: {
            where: { deletedAt: null },
            orderBy: { paymentDate: "desc" },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        customerId: z.string(),
        invoiceType: z.enum(["invoice", "bill_of_supply"]).default("invoice"),
        invoiceDate: z.string(),
        dueDate: z.string(),
        placeOfSupply: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        terms: z.string().optional().nullable(),
        status: z.enum(["draft", "sent"]).default("draft"),
        lines: z.array(lineItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { companyId, lines: lineInputs, ...invoiceData } = input;

      // Get company state for GST calculation
      const company = await ctx.db.company.findUniqueOrThrow({
        where: { id: companyId },
        select: {
          state: true,
          bankName: true,
          bankAccountNo: true,
          bankIfsc: true,
          bankBranch: true,
          bankUpiId: true,
          defaultTerms: true,
        },
      });

      const interState = isInterState(company.state, input.placeOfSupply);

      // Calculate each line
      const calculatedLines = lineInputs.map((line, idx) => {
        const calc = calcLineItem(
          {
            quantity: line.quantity,
            rate: line.rate,
            gstRate: line.gstRate,
            discountType: line.discountType,
            discountValue: line.discountValue,
          },
          interState
        );
        return {
          ...line,
          sortOrder: idx,
          taxableAmount: calc.taxableAmount,
          cgstAmount: calc.cgstAmount,
          sgstAmount: calc.sgstAmount,
          igstAmount: calc.igstAmount,
          lineTotal: calc.lineTotal,
          discountAmount: calc.discountAmount,
        };
      });

      // Calculate invoice totals
      const totals = calcInvoiceTotals(
        calculatedLines.map((l) => ({
          amount: l.quantity * l.rate,
          discountAmount: l.discountAmount,
          taxableAmount: l.taxableAmount,
          cgstAmount: l.cgstAmount,
          sgstAmount: l.sgstAmount,
          igstAmount: l.igstAmount,
          lineTotal: l.lineTotal,
        }))
      );

      // Generate invoice number (or BOS number)
      const isBos = input.invoiceType === "bill_of_supply";
      const invoiceNumber = isBos
        ? await generateBosNumber(ctx.db, companyId)
        : await generateInvoiceNumber(ctx.db, companyId);

      // Create invoice + lines in a transaction
      const invoice = await ctx.db.invoice.create({
        data: {
          companyId,
          invoiceNumber,
          invoiceType: input.invoiceType,
          customerId: invoiceData.customerId,
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: new Date(invoiceData.dueDate),
          placeOfSupply: invoiceData.placeOfSupply,
          status: invoiceData.status,
          notes: invoiceData.notes ?? company.defaultTerms,
          terms: invoiceData.terms,
          bankName: company.bankName,
          bankAccountNo: company.bankAccountNo,
          bankIfsc: company.bankIfsc,
          bankBranch: company.bankBranch,
          bankUpiId: company.bankUpiId,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          lines: {
            create: calculatedLines.map((line) => ({
              itemId: line.itemId,
              sortOrder: line.sortOrder,
              description: line.description,
              hsnSacCode: line.hsnSacCode,
              quantity: line.quantity,
              unit: line.unit,
              rate: line.rate,
              gstRate: line.gstRate,
              discountType: line.discountType,
              discountValue: line.discountValue,
              discountAmount: line.discountAmount,
              taxableAmount: line.taxableAmount,
              cgstAmount: line.cgstAmount,
              sgstAmount: line.sgstAmount,
              igstAmount: line.igstAmount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          customer: true,
          lines: true,
        },
      });

      return invoice;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoice.update({
        where: { id: input.id },
        data: { status: input.status, updatedBy: ctx.userId },
      });
    }),

  /** Update TDS + follow-up compliance fields */
  updateCompliance: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        tdsApplicable: z.boolean().optional(),
        tdsRate: z.number().min(0).max(100).optional().nullable(),
        tdsAmount: z.number().min(0).optional(),
        tdsCertificateStatus: z.string().optional(),
        tdsCertificateReceivedDate: z.string().optional().nullable(),
        nextFollowUpDate: z.string().optional().nullable(),
        followUpNotes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tdsCertificateReceivedDate, nextFollowUpDate, ...rest } = input;
      return ctx.db.invoice.update({
        where: { id },
        data: {
          ...rest,
          ...(tdsCertificateReceivedDate !== undefined
            ? { tdsCertificateReceivedDate: tdsCertificateReceivedDate ? new Date(tdsCertificateReceivedDate) : null }
            : {}),
          ...(nextFollowUpDate !== undefined
            ? { nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null }
            : {}),
          updatedBy: ctx.userId,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoice.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), updatedBy: ctx.userId },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inv = await ctx.db.invoice.update({
        where: { id: input.id },
        data: { deletedAt: null, updatedBy: ctx.userId },
      });
      // Recompute status after restore
      const computed = computeInvoiceStatus(inv);
      if (computed !== inv.status) {
        return ctx.db.invoice.update({
          where: { id: inv.id },
          data: { status: computed },
        });
      }
      return inv;
    }),

  downloadPdf: protectedProcedure
    .input(z.object({ id: z.string(), companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch invoice with customer and lines
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          customer: true,
          lines: { orderBy: { sortOrder: "asc" } },
        },
      });

      // Verify invoice belongs to the company
      if (invoice.companyId !== input.companyId) {
        throw new Error("Invoice does not belong to this company");
      }

      // Fetch company details
      const company = await ctx.db.company.findUniqueOrThrow({
        where: { id: input.companyId },
      });

      // Build address strings with natural line breaks matching reference format
      function buildAddress(
        line1: string | null, line2: string | null,
        city: string | null, state: string | null, pin: string | null,
      ): string {
        const parts: string[] = [];
        if (line1) parts.push(line1 + ",");
        if (line2) parts.push(line2 + ",");
        const cityLine = [city, state, pin].filter(Boolean).join(" ");
        if (cityLine) parts.push(cityLine);
        if (parts.length > 0) parts.push("India");
        return parts.join("\n");
      }

      const companyAddress = buildAddress(
        company.addressLine1, company.addressLine2,
        company.city, company.stateName, company.pincode,
      );

      const customerAddress = buildAddress(
        invoice.customer.billingAddressLine1, invoice.customer.billingAddressLine2,
        invoice.customer.billingCity, invoice.customer.billingStateName, invoice.customer.billingPincode,
      );

      // Format date as dd/mm/yyyy
      function fmtDate(d: Date): string {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }

      // Format placeOfSupply as "State Name (code)"
      function fmtPlaceOfSupply(code: string | null | undefined): string | null {
        if (!code) return null;
        const state = INDIAN_STATES.find((s) => s.code === code);
        return state ? `${state.name} (${state.code})` : code;
      }

      // Determine inter-state
      const inter = isInterState(company.state, invoice.placeOfSupply);

      // Map line items
      const pdfLines: PdfLineItem[] = invoice.lines.map((l) => ({
        description: l.description,
        hsnSac: l.hsnSacCode || "",
        qty: Number(l.quantity),
        unit: l.unit || undefined,
        rate: Number(l.rate),
        taxable: Number(l.taxableAmount),
        gstRate: Number(l.gstRate),
        gstAmount: Number(l.cgstAmount) + Number(l.sgstAmount) + Number(l.igstAmount),
        total: Number(l.lineTotal),
      }));

      // Compute round-off
      const rawTotal =
        Number(invoice.taxableAmount) +
        Number(invoice.cgstAmount) +
        Number(invoice.sgstAmount) +
        Number(invoice.igstAmount);
      const roundOff = Number(invoice.totalAmount) - rawTotal;

      // Build terms string
      const terms = invoice.terms || null;

      // Generate the PDF
      const pdfBuffer = await generateInvoicePdf({
        companyName: company.name,
        companyLegalName: company.legalName,
        companyGstin: company.gstin,
        companyPan: company.pan,
        companyAddress,
        companyPhone: company.phone,
        companyEmail: company.email,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: fmtDate(invoice.invoiceDate),
        dueDate: fmtDate(invoice.dueDate),
        placeOfSupply: fmtPlaceOfSupply(invoice.placeOfSupply),
        terms,
        customerName: invoice.customer.name,
        customerGstin: invoice.customer.gstin,
        customerAddress,
        lines: pdfLines,
        subtotal: Number(invoice.taxableAmount),
        cgst: Number(invoice.cgstAmount),
        sgst: Number(invoice.sgstAmount),
        igst: Number(invoice.igstAmount),
        totalAmount: Number(invoice.totalAmount),
        roundOff: Math.abs(roundOff) > 0.001 ? roundOff : undefined,
        balanceDue: Number(invoice.balanceDue),
        isInterState: inter,
        bankName: invoice.bankName || company.bankName,
        bankAccount: invoice.bankAccountNo || company.bankAccountNo,
        bankIfsc: invoice.bankIfsc || company.bankIfsc,
        bankBranch: invoice.bankBranch || company.bankBranch,
        bankUpi: invoice.bankUpiId || company.bankUpiId,
        notes: invoice.notes,
      });

      // Return as base64 for client-side download
      const filename = `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`;
      return {
        pdf: Buffer.from(pdfBuffer).toString("base64"),
        filename,
      };
    }),
});
