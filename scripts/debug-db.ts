import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function debug() {
  // Check users
  const users = await db.user.findMany({ select: { id: true, email: true, name: true } });
  console.log("Users:", JSON.stringify(users, null, 2));

  // Check company-user links
  const links = await db.companyUser.findMany({
    include: {
      company: { select: { name: true } },
      user: { select: { email: true } },
    },
  });
  console.log("\nCompanyUser links:");
  for (const l of links) {
    console.log(`  ${l.user.email} -> ${l.company.name} (role: ${l.role}, default: ${l.isDefault})`);
  }

  // Check customers
  const custCount = await db.customer.count();
  const custActive = await db.customer.count({ where: { isActive: true, deletedAt: null } });
  const custSample = await db.customer.findMany({
    take: 3,
    select: { id: true, name: true, companyId: true, isActive: true, deletedAt: true },
  });
  console.log(`\nCustomers: ${custCount} total, ${custActive} active`);
  console.log("Sample:", JSON.stringify(custSample, null, 2));

  // Check invoices
  const invCount = await db.invoice.count();
  const invActive = await db.invoice.count({ where: { deletedAt: null } });
  console.log(`\nInvoices: ${invCount} total, ${invActive} active`);

  // Check vendor bills
  const billCount = await db.vendorBill.count();
  console.log(`Vendor Bills: ${billCount}`);

  // Check vendors
  const vendCount = await db.vendor.count();
  console.log(`Vendors: ${vendCount}`);

  // Check payments
  const payCount = await db.payment.count();
  console.log(`Payments: ${payCount}`);

  await db.$disconnect();
}

debug();
