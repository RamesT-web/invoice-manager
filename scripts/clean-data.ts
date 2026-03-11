import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function clean() {
  console.log("Cleaning all imported data...");
  const p = await db.payment.deleteMany({});
  console.log(`  Payments deleted: ${p.count}`);
  const il = await db.invoiceLine.deleteMany({});
  console.log(`  Invoice lines deleted: ${il.count}`);
  const vbl = await db.vendorBillLine.deleteMany({});
  console.log(`  Vendor bill lines deleted: ${vbl.count}`);
  const i = await db.invoice.deleteMany({});
  console.log(`  Invoices deleted: ${i.count}`);
  const vb = await db.vendorBill.deleteMany({});
  console.log(`  Vendor bills deleted: ${vb.count}`);
  const c = await db.customer.deleteMany({});
  console.log(`  Customers deleted: ${c.count}`);
  const v = await db.vendor.deleteMany({});
  console.log(`  Vendors deleted: ${v.count}`);
  console.log("Done!");
  await db.$disconnect();
}

clean();
