/**
 * Rental invoicing orchestrator.
 * Reads Google Sheets → creates invoices → generates PDFs → writes back to Sheets.
 */

import { PrismaClient } from "@prisma/client";
import {
  readClientsSheet,
  readChargesSheet,
  writeInvoiceRegister,
  type RentalClient,
  type MonthlyCharge,
  type InvoiceRegisterRow,
} from "@/lib/sync/google-sheets-api";
import { generateInvoiceNumber } from "@/server/services/invoice-number";
import {
  calcLineItem,
  calcInvoiceTotals,
  isInterState,
} from "@/server/services/gst";
import { generateInvoicePdf, type PdfLineItem } from "@/server/services/pdf-invoice";
import { storage } from "@/lib/storage";

// ─── Types ──────────────────────────────────────────────────

export interface RentalRunResult {
  runId: string;
  month: string;
  status: string;
  totalClients: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{ clientName: string; error: string }>;
}

// ─── Helpers ────────────────────────────────────────────────

function buildAddress(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Main Entry Point ───────────────────────────────────────

export async function executeRentalRun(
  db: PrismaClient,
  companyId: string,
  month: string,
  userId: string
): Promise<RentalRunResult> {
  const spreadsheetId = process.env.RENTAL_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("RENTAL_SPREADSHEET_ID env var is not set");
  }

  // 1. Create InvoiceRun record
  const run = await db.invoiceRun.create({
    data: {
      companyId,
      month,
      status: "running",
      createdBy: userId,
    },
  });

  const errors: Array<{ clientName: string; error: string }> = [];
  const registerRows: InvoiceRegisterRow[] = [];
  let successCount = 0;
  let skippedCount = 0;

  try {
    // 2. Read data from Google Sheets
    const [clients, charges] = await Promise.all([
      readClientsSheet(spreadsheetId),
      readChargesSheet(spreadsheetId, month),
    ]);

    // Build charges lookup by clientId
    const chargesByClient = new Map<string, MonthlyCharge>();
    for (const ch of charges) {
      chargesByClient.set(ch.clientId, ch);
    }

    // Filter active clients with charges
    const activeClients = clients.filter(
      (c) => c.status.toLowerCase() === "active" && chargesByClient.has(c.clientId)
    );

    // Update totalClients
    await db.invoiceRun.update({
      where: { id: run.id },
      data: { totalClients: activeClients.length },
    });

    // 3. Get company details
    const company = await db.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        name: true,
        legalName: true,
        gstin: true,
        pan: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        stateName: true,
        pincode: true,
        phone: true,
        email: true,
        bankName: true,
        bankAccountNo: true,
        bankIfsc: true,
        bankBranch: true,
        bankUpiId: true,
        defaultTerms: true,
        defaultPaymentTermsDays: true,
      },
    });

    // 4. Process each client
    for (const client of activeClients) {
      try {
        const result = await processClient(
          db,
          companyId,
          company,
          client,
          chargesByClient.get(client.clientId)!,
          month,
          run.id,
          userId
        );

        if (result.skipped) {
          skippedCount++;
          registerRows.push({
            invoiceNumber: result.invoiceNumber || "",
            clientId: client.clientId,
            clientName: client.clientName,
            month,
            taxable: 0,
            gst: 0,
            total: 0,
            status: "SKIPPED",
            pdfLink: "",
            errorMessage: "Already invoiced",
            generatedAt: new Date().toISOString(),
          });
        } else {
          successCount++;
          registerRows.push({
            invoiceNumber: result.invoiceNumber!,
            clientId: client.clientId,
            clientName: client.clientName,
            month,
            taxable: result.taxable!,
            gst: result.gst!,
            total: result.total!,
            status: "GENERATED",
            pdfLink: result.pdfLink || "",
            errorMessage: "",
            generatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ clientName: client.clientName, error: errorMsg });
        registerRows.push({
          invoiceNumber: "",
          clientId: client.clientId,
          clientName: client.clientName,
          month,
          taxable: 0,
          gst: 0,
          total: 0,
          status: "ERROR",
          pdfLink: "",
          errorMessage: errorMsg,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    // 5. Write results to Google Sheets
    try {
      await writeInvoiceRegister(spreadsheetId, registerRows);
    } catch (err) {
      console.error("[RentalInvoicing] Failed to write Invoice_Register:", err);
    }

    // 6. Update run record
    const finalStatus = errors.length > 0 && successCount === 0 ? "failed" : "completed";
    await db.invoiceRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        totalClients: activeClients.length,
        successCount,
        errorCount: errors.length,
        skippedCount,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      month,
      status: finalStatus,
      totalClients: activeClients.length,
      successCount,
      errorCount: errors.length,
      skippedCount,
      errors,
    };
  } catch (err) {
    // Fatal error — mark run as failed
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db.invoiceRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errors: JSON.stringify([{ clientName: "_FATAL_", error: errorMsg }]),
        completedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      month,
      status: "failed",
      totalClients: 0,
      successCount: 0,
      errorCount: 1,
      skippedCount: 0,
      errors: [{ clientName: "_FATAL_", error: errorMsg }],
    };
  }
}

// ─── Process Single Client ──────────────────────────────────

interface ProcessResult {
  skipped: boolean;
  invoiceNumber?: string;
  taxable?: number;
  gst?: number;
  total?: number;
  pdfLink?: string;
}

async function processClient(
  db: PrismaClient,
  companyId: string,
  company: {
    name: string;
    legalName: string | null;
    gstin: string | null;
    pan: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    stateName: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
    bankBranch: string | null;
    bankUpiId: string | null;
    defaultTerms: string | null;
    defaultPaymentTermsDays: number;
  },
  client: RentalClient,
  charge: MonthlyCharge,
  month: string,
  runId: string,
  userId: string
): Promise<ProcessResult> {
  // A. Upsert customer
  let customer = await db.customer.findFirst({
    where: {
      companyId,
      name: { equals: client.clientName, mode: "insensitive" },
      deletedAt: null,
    },
  });

  if (!customer) {
    customer = await db.customer.create({
      data: {
        companyId,
        name: client.clientName,
        gstin: client.gstin,
        pan: client.pan,
        billingAddressLine1: client.billingAddress,
        billingCity: client.city,
        billingState: client.state,
        billingStateName: client.state,
        billingPincode: client.pincode,
        contactEmail: client.email,
        contactPhone: client.phone,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  // B. Idempotency check
  const existing = await db.invoice.findFirst({
    where: {
      companyId,
      customerId: customer.id,
      rentalMonth: month,
      deletedAt: null,
    },
  });

  if (existing) {
    return { skipped: true, invoiceNumber: existing.invoiceNumber };
  }

  // C. Build line items (only for non-zero charges)
  const inter = isInterState(company.state, client.placeOfSupply || client.state);

  interface ChargeEntry {
    desc: string;
    amount: number;
    hsn: string;
  }

  const chargeEntries: ChargeEntry[] = [];
  if (charge.rentBase > 0)
    chargeEntries.push({ desc: `Rent - ${month}`, amount: charge.rentBase, hsn: "997212" });
  if (charge.maintenance > 0)
    chargeEntries.push({ desc: `Maintenance - ${month}`, amount: charge.maintenance, hsn: "998511" });
  if (charge.eb > 0)
    chargeEntries.push({ desc: `Electricity (EB) - ${month}`, amount: charge.eb, hsn: "271600" });
  if (charge.dg > 0)
    chargeEntries.push({ desc: `DG Charges - ${month}`, amount: charge.dg, hsn: "271600" });
  if (charge.otherCharges > 0)
    chargeEntries.push({
      desc: charge.otherDescription || `Other Charges - ${month}`,
      amount: charge.otherCharges,
      hsn: "999799",
    });

  if (chargeEntries.length === 0) {
    return { skipped: true };
  }

  // D. Calculate GST per line
  const calculatedLines = chargeEntries.map((entry, idx) => {
    const calc = calcLineItem(
      { quantity: 1, rate: entry.amount, gstRate: charge.gstPercent },
      inter
    );
    return {
      sortOrder: idx,
      description: entry.desc,
      hsnSacCode: entry.hsn,
      quantity: 1,
      unit: "nos",
      rate: entry.amount,
      gstRate: charge.gstPercent,
      ...calc,
    };
  });

  const totals = calcInvoiceTotals(
    calculatedLines.map((l) => ({
      amount: l.amount,
      discountAmount: l.discountAmount,
      taxableAmount: l.taxableAmount,
      cgstAmount: l.cgstAmount,
      sgstAmount: l.sgstAmount,
      igstAmount: l.igstAmount,
      lineTotal: l.lineTotal,
    }))
  );

  // E. Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(db, companyId);

  // F. Set dates
  const invoiceDate = new Date(`${month}-01`);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + company.defaultPaymentTermsDays);

  // G. Create invoice + lines
  const invoice = await db.invoice.create({
    data: {
      companyId,
      invoiceNumber,
      customerId: customer.id,
      invoiceDate,
      dueDate,
      status: "sent",
      placeOfSupply: client.placeOfSupply || client.state,
      rentalMonth: month,
      invoiceRunId: runId,
      subtotal: totals.subtotal,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      totalAmount: totals.totalAmount,
      balanceDue: totals.totalAmount,
      notes: company.defaultTerms,
      bankName: company.bankName,
      bankAccountNo: company.bankAccountNo,
      bankIfsc: company.bankIfsc,
      bankBranch: company.bankBranch,
      bankUpiId: company.bankUpiId,
      createdBy: userId,
      updatedBy: userId,
      lines: {
        create: calculatedLines.map((l) => ({
          description: l.description,
          hsnSacCode: l.hsnSacCode,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          gstRate: l.gstRate,
          taxableAmount: l.taxableAmount,
          cgstAmount: l.cgstAmount,
          sgstAmount: l.sgstAmount,
          igstAmount: l.igstAmount,
          lineTotal: l.lineTotal,
          sortOrder: l.sortOrder,
        })),
      },
    },
    include: { customer: true, lines: true },
  });

  // H. Generate PDF
  const gstTotal = totals.cgstAmount + totals.sgstAmount + totals.igstAmount;
  const pdfLines: PdfLineItem[] = calculatedLines.map((l) => ({
    description: l.description,
    hsnSac: l.hsnSacCode || "",
    qty: l.quantity,
    unit: l.unit || undefined,
    rate: l.rate,
    taxable: l.taxableAmount,
    gstRate: l.gstRate,
    gstAmount: l.cgstAmount + l.sgstAmount + l.igstAmount,
    total: l.lineTotal,
  }));

  const pdfBuffer = await generateInvoicePdf({
    companyName: company.name,
    companyLegalName: company.legalName,
    companyGstin: company.gstin,
    companyPan: company.pan,
    companyAddress: buildAddress([
      company.addressLine1,
      company.addressLine2,
      company.city,
      company.stateName,
      company.pincode,
    ]),
    companyPhone: company.phone,
    companyEmail: company.email,
    invoiceNumber,
    invoiceDate: formatDate(invoiceDate),
    dueDate: formatDate(dueDate),
    placeOfSupply: client.placeOfSupply || client.state,
    terms: `${company.defaultPaymentTermsDays} Days`,
    customerName: client.clientName,
    customerGstin: client.gstin,
    customerAddress: buildAddress([
      client.billingAddress,
      client.city,
      client.state,
      client.pincode,
    ]),
    lines: pdfLines,
    subtotal: totals.taxableAmount,
    cgst: totals.cgstAmount,
    sgst: totals.sgstAmount,
    igst: totals.igstAmount,
    totalAmount: totals.totalAmount,
    isInterState: inter,
    bankName: company.bankName,
    bankAccount: company.bankAccountNo,
    bankIfsc: company.bankIfsc,
    bankBranch: company.bankBranch,
    bankUpi: company.bankUpiId,
    notes: company.defaultTerms,
  });

  // I. Upload PDF to storage
  const storageKey = `invoices/${companyId}/${month}/${invoiceNumber.replace(/\//g, "-")}.pdf`;
  await storage.upload(storageKey, pdfBuffer, "application/pdf");

  // J. Create attachment record
  await db.attachment.create({
    data: {
      companyId,
      entityType: "invoice",
      entityId: invoice.id,
      fileName: `${invoiceNumber.replace(/\//g, "-")}.pdf`,
      fileSize: pdfBuffer.length,
      mimeType: "application/pdf",
      storagePath: storageKey,
      uploadedBy: userId,
    },
  });

  return {
    skipped: false,
    invoiceNumber,
    taxable: totals.taxableAmount,
    gst: gstTotal,
    total: totals.totalAmount,
    pdfLink: storageKey,
  };
}
