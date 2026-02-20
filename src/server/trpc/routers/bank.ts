import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createHash } from "crypto";

function hashRow(date: string, description: string, amount: string): string {
  return createHash("sha256")
    .update(`${date}|${description}|${amount}`)
    .digest("hex");
}

const txnRowSchema = z.object({
  txnDate: z.string(),
  description: z.string(),
  narration: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  debit: z.number().default(0),
  credit: z.number().default(0),
  balance: z.number().optional().nullable(),
});

export const bankRouter = router({
  /** List bank transactions */
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { companyId: input.companyId };
      if (input.status) where.status = input.status;

      return ctx.db.bankTransaction.findMany({
        where: where as never,
        include: {
          matchedPayment: {
            select: {
              id: true,
              amount: true,
              invoice: { select: { id: true, invoiceNumber: true } },
            },
          },
        },
        orderBy: { txnDate: "desc" },
        take: 500,
      });
    }),

  /** Import bank CSV rows — skips duplicates via importHash */
  import: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        bankAccountLabel: z.string().optional(),
        rows: z.array(txnRowSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let imported = 0;
      let skipped = 0;

      for (const row of input.rows) {
        const amount = row.credit > 0 ? row.credit : row.debit;
        const hash = hashRow(row.txnDate, row.description, amount.toString());

        try {
          await ctx.db.bankTransaction.create({
            data: {
              companyId: input.companyId,
              txnDate: new Date(row.txnDate),
              description: row.description,
              narration: row.narration,
              referenceNumber: row.referenceNumber,
              debit: row.debit,
              credit: row.credit,
              balance: row.balance,
              bankAccountLabel: input.bankAccountLabel,
              importHash: hash,
            },
          });
          imported++;
        } catch (e: unknown) {
          // Unique constraint violation = duplicate, skip
          if (
            e &&
            typeof e === "object" &&
            "code" in e &&
            (e as { code: string }).code === "P2002"
          ) {
            skipped++;
          } else {
            throw e;
          }
        }
      }

      return { imported, skipped, total: input.rows.length };
    }),

  /** Suggest matches: find unmatched credit txns and look for invoices with similar amounts */
  suggestMatches: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get unmatched credit transactions (incoming money)
      const unmatchedTxns = await ctx.db.bankTransaction.findMany({
        where: {
          companyId: input.companyId,
          status: "unmatched",
          credit: { gt: 0 },
        },
        orderBy: { txnDate: "desc" },
        take: 100,
      });

      // Get unpaid/partially paid invoices
      const openInvoices = await ctx.db.invoice.findMany({
        where: {
          companyId: input.companyId,
          deletedAt: null,
          status: { in: ["sent", "partially_paid", "overdue"] },
          balanceDue: { gt: 0 },
        },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
      });

      // Match suggestions: amount match (exact or close) + narration keyword match
      const suggestions = unmatchedTxns.map((txn) => {
        const creditAmt = Number(txn.credit);
        const descLower = (txn.description + " " + (txn.narration ?? "")).toLowerCase();

        const candidates = openInvoices
          .map((inv) => {
            const balance = Number(inv.balanceDue);
            const total = Number(inv.totalAmount);
            let score = 0;

            // Exact amount match with balance
            if (Math.abs(creditAmt - balance) < 0.01) score += 50;
            // Exact amount match with total
            else if (Math.abs(creditAmt - total) < 0.01) score += 40;
            // Close amount (within 5%)
            else if (Math.abs(creditAmt - balance) / balance < 0.05) score += 20;

            // Customer name in narration
            const custName = inv.customer.name.toLowerCase();
            const custWords = custName.split(/\s+/);
            if (custWords.some((w) => w.length > 2 && descLower.includes(w))) score += 15;

            // Invoice number in narration
            if (descLower.includes(inv.invoiceNumber.toLowerCase())) score += 30;

            // Reference number overlap
            if (txn.referenceNumber && inv.invoiceNumber.includes(txn.referenceNumber)) score += 20;

            return { invoice: inv, score };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        return { transaction: txn, candidates };
      });

      return suggestions.filter((s) => s.candidates.length > 0);
    }),

  /** Match a bank transaction to a payment */
  match: protectedProcedure
    .input(
      z.object({
        bankTransactionId: z.string().uuid(),
        invoiceId: z.string().uuid(),
        companyId: z.string().uuid(),
        amount: z.number().positive(),
        paymentDate: z.string(),
        paymentMode: z.string().default("bank_transfer"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        select: { customerId: true, totalAmount: true, amountPaid: true },
      });

      const newPaid = Number(invoice.amountPaid) + input.amount;
      const newBalance = Number(invoice.totalAmount) - newPaid;
      const newStatus = newBalance <= 0 ? "paid" : "partially_paid";

      const [payment] = await ctx.db.$transaction([
        ctx.db.payment.create({
          data: {
            companyId: input.companyId,
            type: "received",
            invoiceId: input.invoiceId,
            customerId: invoice.customerId,
            paymentDate: new Date(input.paymentDate),
            amount: input.amount,
            paymentMode: input.paymentMode,
            createdBy: ctx.userId,
          },
        }),
        ctx.db.invoice.update({
          where: { id: input.invoiceId },
          data: {
            amountPaid: newPaid,
            balanceDue: Math.max(0, newBalance),
            status: newStatus,
            updatedBy: ctx.userId,
          },
        }),
        ctx.db.bankTransaction.update({
          where: { id: input.bankTransactionId },
          data: { status: "matched" },
        }),
      ]);

      // Link the payment to the bank transaction
      await ctx.db.bankTransaction.update({
        where: { id: input.bankTransactionId },
        data: { matchedPaymentId: payment.id },
      });

      return payment;
    }),

  /** Ignore a bank transaction (mark it as not relevant) */
  ignore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bankTransaction.update({
        where: { id: input.id },
        data: { status: "ignored" },
      });
    }),

  /** Unignore (reset to unmatched) */
  unignore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bankTransaction.update({
        where: { id: input.id },
        data: { status: "unmatched", matchedPaymentId: null },
      });
    }),
});
