import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function verify() {
  const companies = await db.company.findMany({ select: { id: true, name: true } });
  for (const c of companies) {
    const cust = await db.customer.count({ where: { companyId: c.id } });
    const vend = await db.vendor.count({ where: { companyId: c.id } });
    const inv = await db.invoice.count({ where: { companyId: c.id } });
    const bills = await db.vendorBill.count({ where: { companyId: c.id } });
    const payR = await db.payment.count({ where: { companyId: c.id, type: "received" } });
    const payM = await db.payment.count({ where: { companyId: c.id, type: "made" } });
    console.log(`\n${c.name}:`);
    console.log(`  Customers:       ${cust}`);
    console.log(`  Vendors:         ${vend}`);
    console.log(`  Invoices:        ${inv}`);
    console.log(`  Vendor Bills:    ${bills}`);
    console.log(`  Payments (recv): ${payR}`);
    console.log(`  Payments (made): ${payM}`);
  }
  await db.$disconnect();
}

verify();
