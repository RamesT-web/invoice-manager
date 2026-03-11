import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createHash } from "crypto";

function hashRow(date: string, description: string, amount: string): string {
  return createHash("sha256")
    .update(`${date}|${description}|${amount}`)
    .digest("hex");
}

/** Common business words to exclude from customer name matching */
const COMMON_WORDS = new Set([
  "private", "limited", "pvt", "ltd", "llp", "inc", "co", "corp",
  "solutions", "services", "enterprises", "company", "technologies",
  "india", "industries", "international", "global", "group", "the",
  "and", "for", "from", "with", "payment", "transfer", "fund",
]);

/** Extract payer name from Indian bank description formats */
function extractPayerName(desc: string): string {
  // RTGS: RTGS-BANKCODE-CUSTOMER NAME-ACCOUNTNO
  const rtgs = desc.match(/RTGS-[A-Z0-9]+-(.+?)(?:-\d{5,}|$)/i);
  if (rtgs) return rtgs[1].trim();

  // NEFT: NEFT-CODE-CUSTOMER NAME-REF/...
  const neft = desc.match(/NEFT-[A-Z0-9]+-(.+?)(?:-REF\/|-\d{5,}|$)/i);
  if (neft) return neft[1].trim();

  // INF/INFT: INF/INFT/TXNID/remark/CUSTOMER NAME
  const inft = desc.match(/INF\/INFT\/\d+\/(.+)/i);
  if (inft) {
    const parts = inft[1].split("/").map((s) => s.trim()).filter(Boolean);
    // Last meaningful part is usually the name
    if (parts.length >= 2) return parts[parts.length - 1];
    if (parts.length === 1) return parts[0];
  }

  // IMPS: MMT/IMPS/TXNID/remark by/NAME
  const imps = desc.match(/MMT\/IMPS\/\d+\/(.+)/i);
  if (imps) {
    const byMatch = imps[1].match(/by\/(.+)/i);
    if (byMatch) return byMatch[1].trim();
    return imps[1].split("/")[0].trim();
  }

  // UPI: UPI/TXNID/remark/PAYERID
  const upi = desc.match(/UPI\/\d+\/(.+?)(?:\/[a-z0-9@]|$)/i);
  if (upi) return upi[1].trim();

  return "";
}

/** Get distinctive words from a name (excluding common business words) */
function getDistinctiveWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMMON_WORDS.has(w));
}

/** Score how well a customer name matches a bank description */
function scoreCustomerMatch(descLower: string, payerName: string, customerName: string): number {
  const custWords = getDistinctiveWords(customerName);
  if (custWords.length === 0) return 0;

  // Check against extracted payer name first (more reliable)
  if (payerName) {
    const payerLower = payerName.toLowerCase();
    const payerWords = getDistinctiveWords(payerName);

    // Strong match: payer name contains most customer distinctive words
    const payerHits = custWords.filter((w) => payerLower.includes(w)).length;
    if (payerHits >= Math.max(1, custWords.length * 0.6)) return 40;
  }

  // Fallback: check full description for customer words
  const descHits = custWords.filter((w) => descLower.includes(w)).length;
  if (descHits >= Math.max(1, custWords.length * 0.6)) return 25;

  return 0;
}

/** Common TDS rates in India */
const TDS_RATES = [0.01, 0.02, 0.05, 0.075, 0.10];

/** Check if credit amount matches invoice after TDS deduction */
function scoreTdsMatch(creditAmt: number, invoiceAmt: number): number {
  for (const rate of TDS_RATES) {
    const afterTds = invoiceAmt * (1 - rate);
    if (Math.abs(creditAmt - afterTds) < 1) return 35; // Within ₹1
    if (invoiceAmt > 0 && Math.abs(creditAmt - afterTds) / invoiceAmt < 0.005) return 30; // Within 0.5%
  }
  return 0;
}

/** Score a bank transaction against an invoice */
function scoreMatch(
  txn: { credit: number | { toNumber(): number }; description: string; narration: string | null; referenceNumber: string | null },
  inv: { invoiceNumber: string; balanceDue: number | { toNumber(): number }; totalAmount: number | { toNumber(): number }; customer: { name: string } }
): number {
  const creditAmt = typeof txn.credit === "number" ? txn.credit : txn.credit.toNumber();
  const balance = typeof inv.balanceDue === "number" ? inv.balanceDue : inv.balanceDue.toNumber();
  const total = typeof inv.totalAmount === "number" ? inv.totalAmount : inv.totalAmount.toNumber();
  const descLower = (txn.description + " " + (txn.narration ?? "")).toLowerCase();
  const payerName = extractPayerName(txn.description);

  let score = 0;

  // --- Amount scoring ---
  if (Math.abs(creditAmt - balance) < 0.01) score += 60;           // Exact match with balance
  else if (Math.abs(creditAmt - total) < 0.01) score += 55;        // Exact match with total
  else {
    const tdsScore = scoreTdsMatch(creditAmt, balance) || scoreTdsMatch(creditAmt, total);
    if (tdsScore > 0) score += tdsScore;                            // TDS-adjusted match
    else if (balance > 0 && Math.abs(creditAmt - balance) / balance < 0.05) score += 20; // Within 5%
  }

  // --- Customer name scoring ---
  score += scoreCustomerMatch(descLower, payerName, inv.customer.name);

  // --- Invoice number in description ---
  if (descLower.includes(inv.invoiceNumber.toLowerCase())) score += 30;

  // --- Reference number overlap ---
  if (txn.referenceNumber && inv.invoiceNumber.includes(txn.referenceNumber)) score += 20;

  return score;
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
        companyId: z.string(),
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
        companyId: z.string(),
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
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const unmatchedTxns = await ctx.db.bankTransaction.findMany({
        where: {
          companyId: input.companyId,
          status: "unmatched",
          credit: { gt: 0 },
        },
        orderBy: { txnDate: "desc" },
        take: 100,
      });

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

      const suggestions = unmatchedTxns.map((txn) => {
        const candidates = openInvoices
          .map((inv) => ({
            invoice: inv,
            score: scoreMatch(txn, inv),
          }))
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
        bankTransactionId: z.string(),
        invoiceId: z.string(),
        companyId: z.string(),
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

      await ctx.db.bankTransaction.update({
        where: { id: input.bankTransactionId },
        data: { matchedPaymentId: payment.id },
      });

      return payment;
    }),

  /** Auto-reconcile: automatically match bank txns to invoices */
  autoReconcile: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        minScore: z.number().default(55),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get unmatched credit transactions
      const unmatchedTxns = await ctx.db.bankTransaction.findMany({
        where: {
          companyId: input.companyId,
          status: "unmatched",
          credit: { gt: 0 },
        },
        orderBy: { txnDate: "asc" }, // Oldest first for proper payment sequencing
      });

      // Get open invoices (mutable — we track in-memory balance changes)
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

      // Track running balance changes per invoice
      const invoiceBalances = new Map<string, { paid: number; balance: number; total: number }>();
      for (const inv of openInvoices) {
        invoiceBalances.set(inv.id, {
          paid: Number(inv.amountPaid),
          balance: Number(inv.balanceDue),
          total: Number(inv.totalAmount),
        });
      }

      let matched = 0;
      let skipped = 0;

      for (const txn of unmatchedTxns) {
        // Score against invoices that still have balance
        const candidates = openInvoices
          .filter((inv) => {
            const b = invoiceBalances.get(inv.id);
            return b && b.balance > 0;
          })
          .map((inv) => {
            // Use current in-memory balance for scoring
            const currentBalance = invoiceBalances.get(inv.id)!;
            const invWithBalance = {
              ...inv,
              balanceDue: currentBalance.balance,
              totalAmount: currentBalance.total,
            };
            return {
              invoice: inv,
              score: scoreMatch(txn, invWithBalance),
              currentBalance: currentBalance.balance,
            };
          })
          .filter((c) => c.score >= input.minScore)
          .sort((a, b) => b.score - a.score);

        const best = candidates[0];
        if (!best) {
          skipped++;
          continue;
        }

        const inv = best.invoice;
        const creditAmt = Number(txn.credit);
        const matchAmount = Math.min(creditAmt, best.currentBalance);
        const balTrack = invoiceBalances.get(inv.id)!;
        const newPaid = balTrack.paid + matchAmount;
        const newBalance = balTrack.total - newPaid;
        const newStatus = newBalance <= 0 ? "paid" : "partially_paid";

        try {
          const [payment] = await ctx.db.$transaction([
            ctx.db.payment.create({
              data: {
                companyId: input.companyId,
                type: "received",
                invoiceId: inv.id,
                customerId: inv.customer.id,
                paymentDate: txn.txnDate,
                amount: matchAmount,
                paymentMode: "bank_transfer",
                createdBy: ctx.userId,
              },
            }),
            ctx.db.invoice.update({
              where: { id: inv.id },
              data: {
                amountPaid: newPaid,
                balanceDue: Math.max(0, newBalance),
                status: newStatus,
                updatedBy: ctx.userId,
              },
            }),
            ctx.db.bankTransaction.update({
              where: { id: txn.id },
              data: { status: "matched" },
            }),
          ]);

          await ctx.db.bankTransaction.update({
            where: { id: txn.id },
            data: { matchedPaymentId: payment.id },
          });

          // Update in-memory balance tracker
          balTrack.paid = newPaid;
          balTrack.balance = Math.max(0, newBalance);

          matched++;
        } catch {
          skipped++;
        }
      }

      return { matched, skipped, total: unmatchedTxns.length };
    }),

  /** Ignore a bank transaction (mark it as not relevant) */
  ignore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bankTransaction.update({
        where: { id: input.id },
        data: { status: "ignored" },
      });
    }),

  /** Unignore (reset to unmatched) */
  unignore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bankTransaction.update({
        where: { id: input.id },
        data: { status: "unmatched", matchedPaymentId: null },
      });
    }),
});
