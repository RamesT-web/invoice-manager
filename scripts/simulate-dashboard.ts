import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({ where: { email: "admin@invoicemanager.com" } });
  console.log("User ID:", user?.id);

  const links = await db.companyUser.findMany({ where: { userId: user!.id } });
  console.log("Company links:", links.length);
  for (const l of links) {
    console.log("  companyId:", l.companyId, "role:", l.role);
  }

  const companyId = "00000000-0000-0000-0000-000000000001";

  const cu = await db.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId: user!.id } },
  });
  console.log("\nAccess check:", cu ? "PASS" : "FAIL");

  const totalReceivable = await db.invoice.aggregate({
    where: { companyId, deletedAt: null, status: { notIn: ["cancelled", "draft"] } },
    _sum: { balanceDue: true },
  });
  console.log("totalReceivable:", totalReceivable._sum.balanceDue?.toNumber());

  const totalInvoices = await db.invoice.count({ where: { companyId, deletedAt: null } });
  console.log("totalInvoices:", totalInvoices);

  const recentInvoices = await db.invoice.findMany({
    where: { companyId, deletedAt: null },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log("Recent invoices:", recentInvoices.length);
  for (const r of recentInvoices) {
    console.log("  ", r.invoiceNumber, "|", r.customer.name, "|", r.status, "| total:", r.totalAmount.toString(), "| bal:", r.balanceDue.toString());
  }

  await db.$disconnect();
}

main();
