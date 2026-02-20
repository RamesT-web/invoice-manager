import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const ledgerRouter = router({
  /** Customer ledger: invoices (debit) vs payments (credit) with running balance */
  customerLedger: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        customerId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [customer, invoices, payments] = await Promise.all([
        ctx.db.customer.findUniqueOrThrow({
          where: { id: input.customerId },
          select: { id: true, name: true, openingBalance: true },
        }),
        ctx.db.invoice.findMany({
          where: {
            companyId: input.companyId,
            customerId: input.customerId,
            deletedAt: null,
            status: { notIn: ["draft", "cancelled"] },
          },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
          },
          orderBy: { invoiceDate: "asc" },
        }),
        ctx.db.payment.findMany({
          where: {
            companyId: input.companyId,
            customerId: input.customerId,
            deletedAt: null,
            type: "received",
          },
          select: {
            id: true,
            paymentDate: true,
            amount: true,
            paymentMode: true,
            referenceNumber: true,
            invoice: { select: { invoiceNumber: true } },
          },
          orderBy: { paymentDate: "asc" },
        }),
      ]);

      // Merge into a single timeline sorted by date
      type LedgerEntry = {
        id: string;
        date: Date;
        type: "opening" | "invoice" | "payment";
        description: string;
        debit: number;
        credit: number;
        balance: number;
      };

      const entries: LedgerEntry[] = [];

      // Opening balance
      const openingBal = Number(customer.openingBalance ?? 0);

      // Add invoice entries (debit = customer owes us)
      for (const inv of invoices) {
        entries.push({
          id: inv.id,
          date: new Date(inv.invoiceDate),
          type: "invoice",
          description: `Invoice ${inv.invoiceNumber}`,
          debit: Number(inv.totalAmount),
          credit: 0,
          balance: 0,
        });
      }

      // Add payment entries (credit = customer paid)
      for (const p of payments) {
        entries.push({
          id: p.id,
          date: new Date(p.paymentDate),
          type: "payment",
          description: `Payment${p.invoice?.invoiceNumber ? ` (${p.invoice.invoiceNumber})` : ""}${p.referenceNumber ? ` — ${p.referenceNumber}` : ""}`,
          debit: 0,
          credit: Number(p.amount),
          balance: 0,
        });
      }

      // Sort by date, then invoices before payments on same day
      entries.sort((a, b) => {
        const diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        if (a.type === "invoice" && b.type === "payment") return -1;
        if (a.type === "payment" && b.type === "invoice") return 1;
        return 0;
      });

      // Compute running balance
      let runningBalance = openingBal;
      for (const entry of entries) {
        runningBalance += entry.debit - entry.credit;
        entry.balance = runningBalance;
      }

      return {
        customer: { id: customer.id, name: customer.name },
        openingBalance: openingBal,
        closingBalance: runningBalance,
        entries,
      };
    }),

  /** Vendor ledger: bills (credit/liability) vs payments (debit/paid out) with running balance */
  vendorLedger: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        vendorId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [vendor, bills, payments] = await Promise.all([
        ctx.db.vendor.findUniqueOrThrow({
          where: { id: input.vendorId },
          select: { id: true, name: true, openingBalance: true },
        }),
        ctx.db.vendorBill.findMany({
          where: {
            companyId: input.companyId,
            vendorId: input.vendorId,
            deletedAt: null,
            status: { notIn: ["cancelled"] },
          },
          select: {
            id: true,
            billNumber: true,
            billDate: true,
            totalAmount: true,
          },
          orderBy: { billDate: "asc" },
        }),
        ctx.db.payment.findMany({
          where: {
            companyId: input.companyId,
            vendorId: input.vendorId,
            deletedAt: null,
            type: "made",
          },
          select: {
            id: true,
            paymentDate: true,
            amount: true,
            paymentMode: true,
            referenceNumber: true,
            vendorBill: { select: { billNumber: true } },
          },
          orderBy: { paymentDate: "asc" },
        }),
      ]);

      type LedgerEntry = {
        id: string;
        date: Date;
        type: "opening" | "bill" | "payment";
        description: string;
        debit: number;
        credit: number;
        balance: number;
      };

      const entries: LedgerEntry[] = [];
      const openingBal = Number(vendor.openingBalance ?? 0);

      // Bills = we owe vendor (credit / liability increases)
      for (const bill of bills) {
        entries.push({
          id: bill.id,
          date: new Date(bill.billDate),
          type: "bill",
          description: `Bill ${bill.billNumber}`,
          debit: 0,
          credit: Number(bill.totalAmount),
          balance: 0,
        });
      }

      // Payments = we paid vendor (debit / liability decreases)
      for (const p of payments) {
        entries.push({
          id: p.id,
          date: new Date(p.paymentDate),
          type: "payment",
          description: `Payment${p.vendorBill?.billNumber ? ` (${p.vendorBill.billNumber})` : ""}${p.referenceNumber ? ` — ${p.referenceNumber}` : ""}`,
          debit: Number(p.amount),
          credit: 0,
          balance: 0,
        });
      }

      entries.sort((a, b) => {
        const diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        if (a.type === "bill" && b.type === "payment") return -1;
        if (a.type === "payment" && b.type === "bill") return 1;
        return 0;
      });

      // Running balance: opening + credits - debits (amount we owe)
      let runningBalance = openingBal;
      for (const entry of entries) {
        runningBalance += entry.credit - entry.debit;
        entry.balance = runningBalance;
      }

      return {
        vendor: { id: vendor.id, name: vendor.name },
        openingBalance: openingBal,
        closingBalance: runningBalance,
        entries,
      };
    }),
});
