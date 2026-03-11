import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function debug() {
  const companyId = "00000000-0000-0000-0000-000000000001";

  // Invoice statuses
  const statuses = await db.invoice.groupBy({
    by: ["status"],
    _count: true,
    where: { companyId },
  });
  console.log("TES Invoice statuses:", JSON.stringify(statuses));

  // Total receivable
  const recv = await db.invoice.aggregate({
    where: { companyId, deletedAt: null, status: { notIn: ["cancelled", "draft"] } },
    _sum: { balanceDue: true },
  });
  console.log("Total receivable:", recv._sum.balanceDue?.toString());

  // Total invoice count
  const count = await db.invoice.count({ where: { companyId, deletedAt: null } });
  console.log("Total invoices:", count);

  // Recent invoices with customer
  const recent = await db.invoice.findMany({
    where: { companyId, deletedAt: null },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  for (const r of recent) {
    console.log(`  ${r.invoiceNumber} | ${r.customer.name} | status=${r.status} | total=${r.totalAmount} | bal=${r.balanceDue}`);
  }

  // Payments this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidMonth = await db.payment.aggregate({
    where: { companyId, type: "received", deletedAt: null, paymentDate: { gte: startOfMonth } },
    _sum: { amount: true },
  });
  console.log("Paid this month:", paidMonth._sum.amount?.toString() || "0");

  // Vendor bills
  const billStatuses = await db.vendorBill.groupBy({
    by: ["status"],
    _count: true,
    where: { companyId },
  });
  console.log("Vendor bill statuses:", JSON.stringify(billStatuses));

  await db.$disconnect();
}

debug();
