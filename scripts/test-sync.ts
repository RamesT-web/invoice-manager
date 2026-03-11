import { PrismaClient } from "@prisma/client";
import { runSync } from "../src/lib/sync/sync-service";

async function test() {
  const db = new PrismaClient();

  console.log("=== Testing TES Engineering Sync ===");
  const tes = await runSync("00000000-0000-0000-0000-000000000001", db);
  console.log("Success:", tes.success);
  if (tes.result) {
    console.log("Invoices:", tes.result.invoicesCreated, "created,", tes.result.invoicesUpdated, "updated,", tes.result.invoicesSkipped, "skipped");
    console.log("Bills:", tes.result.billsCreated, "created,", tes.result.billsUpdated, "updated,", tes.result.billsSkipped, "skipped");
    console.log("Customers created:", tes.result.customersCreated, "| Vendors created:", tes.result.vendorsCreated);
    if (tes.result.errors.length > 0) console.log("Errors:", tes.result.errors.slice(0, 5));
  }
  if (tes.error) console.log("Error:", tes.error);
  console.log("Duration:", tes.durationMs, "ms");

  console.log("\n=== Testing Zetasky Sync ===");
  const zeta = await runSync("00000000-0000-0000-0000-000000000002", db);
  console.log("Success:", zeta.success);
  if (zeta.result) {
    console.log("Invoices:", zeta.result.invoicesCreated, "created,", zeta.result.invoicesUpdated, "updated,", zeta.result.invoicesSkipped, "skipped");
    console.log("Bills:", zeta.result.billsCreated, "created,", zeta.result.billsUpdated, "updated,", zeta.result.billsSkipped, "skipped");
    console.log("Customers created:", zeta.result.customersCreated, "| Vendors created:", zeta.result.vendorsCreated);
    if (zeta.result.errors.length > 0) console.log("Errors:", zeta.result.errors.slice(0, 5));
  }
  if (zeta.error) console.log("Error:", zeta.error);
  console.log("Duration:", zeta.durationMs, "ms");

  await db.$disconnect();
}
test().catch(e => { console.error(e); process.exit(1); });
