/**
 * Import script: Reads TES Engineering & Zetasky Excel payment trackers
 * and inserts/updates Customers, Vendors, Invoices, VendorBills, and Payments
 * into the database.
 *
 * Usage:  npx tsx scripts/import-excel.ts
 *         npx tsx scripts/import-excel.ts --dry-run
 */

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { importFromWorkbook } from "../src/lib/sync/import-core";

const db = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("*** DRY RUN MODE — no database writes ***\n");

// ─── CONFIG ────────────────────────────────────────────────

const FILES: {
  file: string;
  companyName: string;
}[] = [
  {
    file: "C:\\Users\\Dell G15 5511\\Downloads\\02_Excel_Spreadsheets\\TES Engineering payment tracker (4).xlsx",
    companyName: "TES Engineering",
  },
  {
    file: "C:\\Users\\Dell G15 5511\\Downloads\\02_Excel_Spreadsheets\\ZETASKY PAYMENT TRACKER (3).xlsx",
    companyName: "Zetasky Pvt Ltd",
  },
];

// ─── MAIN IMPORT ───────────────────────────────────────────

async function importFile(filePath: string, companyName: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Importing: ${path.basename(filePath)}`);
  console.log(`Company:   ${companyName}`);
  console.log("=".repeat(60));

  // Find company
  const company = await db.company.findFirst({
    where: { name: { contains: companyName, mode: "insensitive" } },
  });
  if (!company) {
    console.error(`ERROR: Company "${companyName}" not found in DB!`);
    return;
  }
  console.log(`Found company: ${company.name} (${company.id})`);

  // Read workbook
  const wb = XLSX.readFile(filePath);

  // Delegate to shared import logic
  const result = await importFromWorkbook(wb, company.id, db, {
    dryRun: DRY_RUN,
    logFn: console.log,
  });

  console.log(`\nResults:`);
  console.log(`  Customers created: ${result.customersCreated}`);
  console.log(`  Vendors created:   ${result.vendorsCreated}`);
  console.log(`  Invoices: ${result.invoicesCreated} created, ${result.invoicesUpdated} updated, ${result.invoicesSkipped} skipped`);
  console.log(`  Bills:    ${result.billsCreated} created, ${result.billsUpdated} updated, ${result.billsSkipped} skipped`);
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
  }
}

// ─── RUN ───────────────────────────────────────────────────

async function main() {
  console.log("Excel Import Script");
  console.log("=".repeat(60));

  try {
    await db.$queryRaw`SELECT 1`;
    console.log("Database connected.");

    for (const { file, companyName } of FILES) {
      await importFile(file, companyName);
    }

    console.log("\n" + "=".repeat(60));
    console.log("IMPORT COMPLETE!");

    const totalCustomers = await db.customer.count();
    const totalVendors = await db.vendor.count();
    const totalInvoices = await db.invoice.count();
    const totalBills = await db.vendorBill.count();
    const totalPayments = await db.payment.count();

    console.log(`\nDatabase summary:`);
    console.log(`  Customers:    ${totalCustomers}`);
    console.log(`  Vendors:      ${totalVendors}`);
    console.log(`  Invoices:     ${totalInvoices}`);
    console.log(`  Vendor Bills: ${totalBills}`);
    console.log(`  Payments:     ${totalPayments}`);
  } catch (err) {
    console.error("Import failed:", err);
    throw err;
  } finally {
    await db.$disconnect();
  }
}

main();
