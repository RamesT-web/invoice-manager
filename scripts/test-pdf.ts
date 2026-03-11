/**
 * Quick test script — generates a sample invoice PDF matching the reference data.
 * Run: npx tsx scripts/test-pdf.ts
 * Output: scripts/sample-invoice.pdf
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { generateInvoicePdf, type InvoicePdfData } from "../src/server/services/pdf-invoice";

const sampleData: InvoicePdfData = {
  companyName: "Tes Engineering",
  companyLegalName: "Tes Engineering",
  companyGstin: "33CZIPR0038L1Z7",
  companyPan: "CZIPR0038L",
  companyAddress: "No.3/498, Vembulliamman Kovil Street, Palavakkam, Chennai Tamil Nadu 600041 India",
  companyPhone: "08754441002",
  companyEmail: "ramesh_b@tesengg.com",

  invoiceNumber: "TE/25-26/0279",
  invoiceDate: "07/03/2026",
  dueDate: "21/03/2026",
  placeOfSupply: "Tamil Nadu (33)",
  terms: "15 Days",
  subject: "CCTV Camera Installation & Cable Laying Works \u2013 Gamma Block 5th Floor",

  customerName: "SoftSuave Technologies Private Limited",
  customerGstin: "33AASCS4286R1ZA",
  customerAddress: "Gamma Block, 5th Floor, Alpha City IT Park, Navalur, Chennai Tamil Nadu 600130 India",

  lines: [
    {
      description: "Cat 6 Cable Supply\nSupply of Cat 6 UTP Cable for CCTV Camera Points (1,012 mtr), WiFi Access Points (224 mtr) & Access Control Points (190 mtr)",
      hsnSac: "998719",
      qty: 1426,
      unit: "Mtr",
      rate: 20.0,
      taxable: 28520.0,
      gstRate: 18,
      gstAmount: 5133.6,
      total: 28520.0,
    },
    {
      description: "Cable Laying Charges\nLabour for laying Cat 6 cable including conduit routing, trunking & termination at all points",
      hsnSac: "998719",
      qty: 1426,
      unit: "Mtr",
      rate: 15.0,
      taxable: 21390.0,
      gstRate: 18,
      gstAmount: 3850.2,
      total: 21390.0,
    },
    {
      description: "CCTV Camera Installation\nInstallation of 36 Nos. IP Cameras (supply by client) including mounting, cabling connection & NVR configuration",
      hsnSac: "998719",
      qty: 36,
      unit: "Nos",
      rate: 500.0,
      taxable: 18000.0,
      gstRate: 18,
      gstAmount: 3240.0,
      total: 18000.0,
    },
  ],

  subtotal: 67910.0,
  cgst: 6111.9,
  sgst: 6111.9,
  igst: 0,
  totalAmount: 80134.0,
  roundOff: 0.2,
  balanceDue: 80134.0,
  isInterState: false,

  bankName: "ICICI Bank (India)",
  bankAccount: "270805000883",
  bankIfsc: "ICIC0002708",
  bankBranch: "Siruseri",
  bankUpi: null,

  notes: "Thanks for your business.",
};

async function main() {
  console.log("Generating sample invoice PDF...");
  const buffer = await generateInvoicePdf(sampleData);
  const outPath = resolve(__dirname, "sample-invoice.pdf");
  writeFileSync(outPath, buffer);
  console.log(`Done! Saved to: ${outPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
