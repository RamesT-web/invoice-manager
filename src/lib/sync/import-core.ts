/**
 * Core import logic extracted from scripts/import-excel.ts
 * Can be used by both CLI import and Google Sheets sync.
 */

import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

// ─── TYPES ───────────────────────────────────────────────

export interface SyncResult {
  invoicesCreated: number;
  invoicesUpdated: number;
  invoicesSkipped: number;
  billsCreated: number;
  billsUpdated: number;
  billsSkipped: number;
  customersCreated: number;
  vendorsCreated: number;
  errors: string[];
  /** Total rows parsed from spreadsheet (sales + purchases) */
  totalRowsParsed?: number;
  /** Sheet names found in the workbook */
  sheetNames?: string[];
}

export interface SalesRow {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: Date | null;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  igst: number;
  discount: number;
  invoiceTotal: number;
  receivedTotal: number;
  balPayment: number;
  receivedDate: Date | null;
  tds: number;
  gstFiled: string;
  gstNo: string;
  remarks: string;
  sheetName: string;
}

export interface PurchaseRow {
  invoiceNumber: string;
  vendorName: string;
  invoiceDate: Date | null;
  taxableAmount: number;
  sgst: number;
  cgst: number;
  igst: number;
  otherCharges: number;
  discount: number;
  invoiceTotal: number;
  paymentStatus: string;
  paymentDate: Date | null;
  tds: number;
  paymentMade: number;
  gstFiled: string;
  gstNo: string;
  remarks: string;
  sheetName: string;
}

// ─── HELPERS ───────────────────────────────────────────────

/** Parse Indian-format numbers like "1,20,750.00" or plain "120750" */
export function parseAmount(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s || s === "-") return 0;
  const cleaned = s.replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Parse dates in various formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, or Excel serial */
export function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "number") {
    if (val < 30000 || val > 55000) return null;
    // Round before converting: Google Sheets exports dates with fractional serials encoding
    // the spreadsheet's timezone offset (e.g. IST "10 Mar" → serial 46090.77 not 46091).
    // Math.round corrects this back to the intended calendar date.
    const serial = Math.round(val);
    return sanitizeDate(new Date(Date.UTC(1899, 11, 30) + serial * 86400000));
  }

  const s = String(val).trim();
  if (!s || s === "-" || s.toLowerCase() === "n/a") return null;

  const match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    let day = parseInt(match[1]!, 10);
    let month = parseInt(match[2]!, 10);
    let year = parseInt(match[3]!, 10);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    // Use Date.UTC so dates are stored as UTC midnight, not local midnight
    return sanitizeDate(new Date(Date.UTC(year, month - 1, day)));
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : sanitizeDate(d);
}

function sanitizeDate(d: Date): Date | null {
  const year = d.getFullYear();
  if (year < 2000 || year > 2030) return null;
  return d;
}

export function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function isDataRow(row: Record<string, unknown>, snoKey: string, invoiceKey: string): boolean {
  const sno = cleanStr(row[snoKey]);
  const inv = cleanStr(row[invoiceKey]);
  if (!sno && !inv) return false;
  const snoLower = sno.toLowerCase();
  if (
    snoLower === "total" || snoLower === "grand total" || snoLower.includes("total") ||
    snoLower === "rent" || snoLower === "manpower" || snoLower === "maintenance" ||
    snoLower === "tes purchase" || snoLower === "tes sales" ||
    snoLower === "purchase" || snoLower === "sales" ||
    snoLower === "s no" || snoLower === "s.no" || snoLower === "sno"
  ) return false;
  if (!inv) return false;
  return true;
}

function isValidGstin(g: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/i.test(g);
}

function normalizePaymentStatus(val: unknown): "paid" | "partially_paid" | "pending" {
  const s = cleanStr(val).toLowerCase();
  if (!s || s === "-" || s === "unpaid" || s === "not paid" || s === "pending") return "pending";
  if (s === "paid" || s === "full" || s === "done" || s === "received" || s === "completed") return "paid";
  if (s.includes("partial") || s.includes("part")) return "partially_paid";
  const num = parseAmount(val);
  if (num > 0) return "partially_paid";
  return "pending";
}

function inferGstRate(taxable: number, sgst: number, cgst: number, igst: number): number {
  if (taxable <= 0) return 18;
  if (igst > 0) {
    const rate = Math.round((igst / taxable) * 100);
    if ([5, 12, 18, 28].includes(rate)) return rate;
  }
  if (sgst > 0 || cgst > 0) {
    const halfRate = Math.round(((sgst || cgst) / taxable) * 100);
    const rate = halfRate * 2;
    if ([5, 12, 18, 28].includes(rate)) return rate;
  }
  return 18;
}

function findKey(headers: string[], ...candidates: string[]): string {
  for (const c of candidates) {
    const found = headers.find((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return "";
}

// ─── HEADER ROW DETECTION ─────────────────────────────────

/** Scan a worksheet for the actual header row (may not be row 1).
 *  Returns the 0-based row index of the header, or 0 if not found. */
function findHeaderRow(ws: XLSX.WorkSheet, requiredTerms: string[]): number {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  // Scan first 40 rows for one that contains at least 2 of the required terms
  const limit = Math.min(rawRows.length, 40);
  for (let i = 0; i < limit; i++) {
    const row = rawRows[i] as unknown[];
    if (!row) continue;
    const cellTexts = row.map((c) => String(c ?? "").toLowerCase().trim());
    let hits = 0;
    for (const term of requiredTerms) {
      if (cellTexts.some((t) => t.includes(term.toLowerCase()))) hits++;
    }
    if (hits >= 2) return i;
  }
  return 0;
}

// ─── SHEET PARSING ─────────────────────────────────────────

export function parseSalesSheet(ws: XLSX.WorkSheet, sheetName: string): SalesRow[] {
  // Auto-detect header row — may not be row 1
  const headerRow = findHeaderRow(ws, ["invoice", "billed company", "company", "customer", "taxable"]);
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", range: headerRow });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]!);
  const snoKey = findKey(headers, "S NO", "S.NO", "SNO", "SL NO", "Sl No");
  const invKey = findKey(headers, "Invoice No", "Invoice Num", "Inv No", "INVOICE NO");
  const custKey = findKey(headers, "Billed Company", "BILLED COMPANY", "Company", "Customer");
  const dateKey = findKey(headers, "Invoice Date", "INV DATE", "Inv Date");
  const taxKey = findKey(headers, "Taxable Amount", "TAXABLE AMOUNT", "Taxable Amt");
  const sgstKey = findKey(headers, "S GST", "SGST");
  const cgstKey = findKey(headers, "C GST", "CGST");
  const igstKey = findKey(headers, "IGST");
  const discountKey = findKey(headers, "DISCOUNT", "Discount", "ADVANCE");
  const totalKey = findKey(headers, "Invoice Total", "INVOICE TOTAL", "Inv Total");
  const recvdKey = findKey(headers, "Received Total", "RECEIVED TOTAL", "Received total", "AMNT TO BE RECEIVED");
  const balKey = findKey(headers, "Bal Payment", "BAL PAYMENT", "Balance");
  const rcdKey = findKey(headers, "RCD Date", "RCD DATE", "Received Date", "RECEIVED DATE");
  const tdsKey = findKey(headers, "TDS");
  const gstFiledKey = findKey(headers, "GST Filed", "GST FILED");
  const gstNoKey = findKey(headers, "GST NO", "GST No", "GSTIN", "GST NUMBER");
  const remarksKey = findKey(headers, "Remarks", "REMARKS");

  if (!invKey && !custKey) return [];

  const rows: SalesRow[] = [];
  for (const row of data) {
    if (!isDataRow(row, snoKey, invKey)) continue;
    const invoiceNumber = cleanStr(row[invKey]);
    const customerName = cleanStr(row[custKey]);
    if (!invoiceNumber || !customerName) continue;

    rows.push({
      invoiceNumber, customerName,
      invoiceDate: parseDate(row[dateKey]),
      taxableAmount: parseAmount(row[taxKey]),
      sgst: parseAmount(row[sgstKey]),
      cgst: parseAmount(row[cgstKey]),
      igst: parseAmount(row[igstKey]),
      discount: parseAmount(row[discountKey]),
      invoiceTotal: parseAmount(row[totalKey]),
      receivedTotal: parseAmount(row[recvdKey]),
      balPayment: parseAmount(row[balKey]),
      receivedDate: parseDate(row[rcdKey]),
      tds: parseAmount(row[tdsKey]),
      gstFiled: cleanStr(row[gstFiledKey]),
      gstNo: cleanStr(row[gstNoKey]),
      remarks: cleanStr(row[remarksKey]),
      sheetName,
    });
  }
  return rows;
}

export function parsePurchaseSheet(ws: XLSX.WorkSheet, sheetName: string): PurchaseRow[] {
  // Auto-detect header row — may not be row 1
  const headerRow = findHeaderRow(ws, ["invoice", "company", "vendor", "taxable"]);
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", range: headerRow });
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]!);
  const snoKey = findKey(headers, "S NO", "S.NO", "SNO", "SL NO");
  const invKey = findKey(headers, "Invoice #", "Invoice No", "Invoice Num", "INV NO", "INVOICE #");
  const vendorKey = findKey(headers, "Company", "COMPANY", "Vendor", "VENDOR");
  const dateKey = findKey(headers, "Invoice Date", "INV DATE", "Inv Date");
  const taxKey = findKey(headers, "Taxable Amount", "TAXABLE AMOUNT", "Taxable Amt");
  const sgstKey = findKey(headers, "S GST", "SGST");
  const cgstKey = findKey(headers, "C GST", "CGST");
  const igstKey = findKey(headers, "IGST");
  const otherKey = findKey(headers, "Other Charges", "OTHER CHARGES");
  const discountKey = findKey(headers, "Discount", "DISCOUNT", "ADVANCE");
  const totalKey = findKey(headers, "Invoice Total", "INVOICE TOTAL", "Inv Total");
  const statusKey = findKey(headers, "Payment Status", "PAYMENT STATUS");
  const payDateKey = findKey(headers, "Payment Date", "PAYMENT DATE");
  const tdsKey = findKey(headers, "TDS");
  const paidKey = findKey(headers, "PAYMENT MADE", "Payment Made", "Paid Amount");
  const gstFiledKey = findKey(headers, "GST Filed", "GST FILED");
  const gstNoKey = findKey(headers, "GST NO", "GST No", "GSTIN", "GST NUMBER");
  const remarksKey = findKey(headers, "Remarks", "REMARKS");

  if (!invKey && !vendorKey) return [];

  const rows: PurchaseRow[] = [];
  for (const row of data) {
    if (!isDataRow(row, snoKey, invKey)) continue;
    const invoiceNumber = cleanStr(row[invKey]);
    const vendorName = cleanStr(row[vendorKey]);
    if (!invoiceNumber || !vendorName) continue;

    rows.push({
      invoiceNumber, vendorName,
      invoiceDate: parseDate(row[dateKey]),
      taxableAmount: parseAmount(row[taxKey]),
      sgst: parseAmount(row[sgstKey]),
      cgst: parseAmount(row[cgstKey]),
      igst: parseAmount(row[igstKey]),
      otherCharges: parseAmount(row[otherKey]),
      discount: parseAmount(row[discountKey]),
      invoiceTotal: parseAmount(row[totalKey]),
      paymentStatus: cleanStr(row[statusKey]),
      paymentDate: parseDate(row[payDateKey]),
      tds: parseAmount(row[tdsKey]),
      paymentMade: parseAmount(row[paidKey]),
      gstFiled: cleanStr(row[gstFiledKey]),
      gstNo: cleanStr(row[gstNoKey]),
      remarks: cleanStr(row[remarksKey]),
      sheetName,
    });
  }
  return rows;
}

// ─── WORKBOOK PARSING ──────────────────────────────────────

export function parseWorkbook(
  wb: XLSX.WorkBook,
  logFn: (msg: string) => void = console.log
): { sales: SalesRow[]; purchases: PurchaseRow[] } {
  const allSales: SalesRow[] = [];
  const allPurchases: PurchaseRow[] = [];

  logFn(`Workbook has ${wb.SheetNames.length} sheets: ${wb.SheetNames.join(", ")}`);

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]!;
    const lower = sheetName.toLowerCase();

    if (lower.includes("sales") || lower.startsWith("s ") || lower.startsWith("s-") || /^s\d/.test(lower)) {
      const rows = parseSalesSheet(ws, sheetName);
      logFn(`Sheet "${sheetName}" → Sales: ${rows.length} rows`);
      allSales.push(...rows);
    } else if (lower.includes("purchase") || lower.startsWith("p ") || lower.startsWith("p-") || /^p\d/.test(lower)) {
      const rows = parsePurchaseSheet(ws, sheetName);
      logFn(`Sheet "${sheetName}" → Purchases: ${rows.length} rows`);
      allPurchases.push(...rows);
    } else {
      const salesRows = parseSalesSheet(ws, sheetName);
      const purchaseRows = parsePurchaseSheet(ws, sheetName);
      logFn(`Sheet "${sheetName}" → Auto-detect: ${salesRows.length} sales, ${purchaseRows.length} purchase rows`);
      if (salesRows.length > purchaseRows.length) {
        allSales.push(...salesRows);
      } else if (purchaseRows.length > 0) {
        allPurchases.push(...purchaseRows);
      }
    }
  }

  return { sales: allSales, purchases: allPurchases };
}

// ─── MAIN IMPORT FUNCTION ──────────────────────────────────

export async function importFromWorkbook(
  wb: XLSX.WorkBook,
  companyId: string,
  db: PrismaClient,
  options: { dryRun?: boolean; logFn?: (msg: string) => void } = {}
): Promise<SyncResult> {
  const { dryRun = false, logFn = console.log } = options;

  const result: SyncResult = {
    invoicesCreated: 0, invoicesUpdated: 0, invoicesSkipped: 0,
    billsCreated: 0, billsUpdated: 0, billsSkipped: 0,
    customersCreated: 0, vendorsCreated: 0, errors: [],
  };

  const { sales: allSales, purchases: allPurchases } = parseWorkbook(wb, logFn);
  logFn(`Total parsed: ${allSales.length} sales rows, ${allPurchases.length} purchase rows`);

  result.totalRowsParsed = allSales.length + allPurchases.length;
  result.sheetNames = wb.SheetNames;

  // ─── Create Customers ──────────────────────
  const customerMap = new Map<string, string>();
  const customerGstMap = new Map<string, string>();

  for (const row of allSales) {
    const name = row.customerName;
    if (!customerMap.has(name)) {
      customerMap.set(name, "");
      if (row.gstNo && isValidGstin(row.gstNo)) {
        customerGstMap.set(name, row.gstNo.toUpperCase());
      }
    }
    if (!customerGstMap.has(name) && row.gstNo && isValidGstin(row.gstNo)) {
      customerGstMap.set(name, row.gstNo.toUpperCase());
    }
  }

  for (const name of Array.from(customerMap.keys())) {
    const gstin = customerGstMap.get(name) || null;
    const existing = await db.customer.findFirst({
      where: { companyId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      customerMap.set(name, existing.id);
      if (gstin && !existing.gstin && !dryRun) {
        await db.customer.update({ where: { id: existing.id }, data: { gstin } });
      }
    } else if (!dryRun) {
      const created = await db.customer.create({ data: { companyId, name, gstin } });
      customerMap.set(name, created.id);
      result.customersCreated++;
    }
  }

  // ─── Create Vendors ────────────────────────
  const vendorMap = new Map<string, string>();
  const vendorGstMap = new Map<string, string>();

  for (const row of allPurchases) {
    const name = row.vendorName;
    if (!vendorMap.has(name)) {
      vendorMap.set(name, "");
      if (row.gstNo && isValidGstin(row.gstNo)) {
        vendorGstMap.set(name, row.gstNo.toUpperCase());
      }
    }
    if (!vendorGstMap.has(name) && row.gstNo && isValidGstin(row.gstNo)) {
      vendorGstMap.set(name, row.gstNo.toUpperCase());
    }
  }

  for (const name of Array.from(vendorMap.keys())) {
    const gstin = vendorGstMap.get(name) || null;
    const existing = await db.vendor.findFirst({
      where: { companyId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      vendorMap.set(name, existing.id);
      if (gstin && !existing.gstin && !dryRun) {
        await db.vendor.update({ where: { id: existing.id }, data: { gstin } });
      }
    } else if (!dryRun) {
      const created = await db.vendor.create({ data: { companyId, name, gstin } });
      vendorMap.set(name, created.id);
      result.vendorsCreated++;
    }
  }

  // ─── Process Invoices ──────────────────────
  for (const row of allSales) {
    const customerId = customerMap.get(row.customerName);
    if (!customerId) { result.invoicesSkipped++; continue; }

    try {
      const invoiceDate = row.invoiceDate || new Date(2025, 0, 1);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const taxableAmount = row.taxableAmount || 0;
      const sgst = row.sgst || 0;
      const cgst = row.cgst || 0;
      const igst = row.igst || 0;
      const total = row.invoiceTotal || (taxableAmount + sgst + cgst + igst);
      const received = row.receivedTotal || 0;
      const balDue = row.balPayment || Math.max(0, total - received);
      const tds = row.tds || 0;

      let status: string;
      if (balDue <= 0 && total > 0) status = "paid";
      else if (received > 0) status = "partially_paid";
      else status = "sent";

      const gstRate = inferGstRate(taxableAmount, sgst, cgst, igst);
      const gstFiledBool = row.gstFiled.toLowerCase() === "yes" || row.gstFiled.toLowerCase() === "y";

      const existingInv = await db.invoice.findFirst({
        where: { companyId, invoiceNumber: row.invoiceNumber },
      });

      if (existingInv) {
        if (!dryRun) {
          await db.invoice.update({
            where: { id: existingInv.id },
            data: {
              invoiceDate, dueDate,
              status, taxableAmount, subtotal: taxableAmount,
              cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
              discountAmount: row.discount || 0, totalAmount: total,
              amountPaid: received, balanceDue: balDue,
              tdsApplicable: tds > 0, tdsAmount: tds,
              vendorGstFiled: gstFiledBool,
              notes: row.remarks || existingInv.notes,
            },
          });

          await db.payment.deleteMany({
            where: { invoiceId: existingInv.id, notes: { startsWith: "Imported from" } },
          });
          if (received > 0) {
            await db.payment.create({
              data: {
                companyId, type: "received", invoiceId: existingInv.id, customerId,
                paymentDate: row.receivedDate || invoiceDate, amount: received,
                paymentMode: "bank_transfer", notes: `Imported from ${row.sheetName}`,
              },
            });
          }
        }
        result.invoicesUpdated++;
        continue;
      }

      if (dryRun) { result.invoicesCreated++; continue; }

      const invoice = await db.invoice.create({
        data: {
          companyId, invoiceNumber: row.invoiceNumber, customerId,
          invoiceDate, dueDate, status,
          subtotal: taxableAmount, taxableAmount,
          cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
          discountAmount: row.discount || 0, totalAmount: total,
          amountPaid: received, balanceDue: balDue,
          tdsApplicable: tds > 0, tdsAmount: tds,
          vendorGstFiled: gstFiledBool, notes: row.remarks || null,
          lines: {
            create: [{
              description: `Imported from sheet: ${row.sheetName}`,
              quantity: 1, rate: taxableAmount, taxableAmount,
              gstRate, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
              lineTotal: total,
            }],
          },
        },
      });

      if (received > 0) {
        await db.payment.create({
          data: {
            companyId, type: "received", invoiceId: invoice.id, customerId,
            paymentDate: row.receivedDate || invoiceDate, amount: received,
            paymentMode: "bank_transfer", notes: `Imported from ${row.sheetName}`,
          },
        });
      }
      result.invoicesCreated++;
    } catch (err: any) {
      result.errors.push(`Invoice ${row.invoiceNumber}: ${err.message?.slice(0, 80)}`);
      result.invoicesSkipped++;
    }
  }

  // ─── Process Vendor Bills ──────────────────
  for (const row of allPurchases) {
    const vendorId = vendorMap.get(row.vendorName);
    if (!vendorId) { result.billsSkipped++; continue; }

    try {
      const billDate = row.invoiceDate || new Date(2025, 0, 1);
      const dueDateBill = new Date(billDate);
      dueDateBill.setDate(dueDateBill.getDate() + 30);

      const taxableAmount = row.taxableAmount || 0;
      const sgst = row.sgst || 0;
      const cgst = row.cgst || 0;
      const igst = row.igst || 0;
      const total = row.invoiceTotal || (taxableAmount + sgst + cgst + igst + (row.otherCharges || 0));
      const tds = row.tds || 0;
      const paidAmount = row.paymentMade || 0;

      const paymentStat = normalizePaymentStatus(row.paymentStatus);
      let billStatus: string;
      if (paymentStat === "paid" || (paidAmount > 0 && paidAmount >= total)) billStatus = "paid";
      else if (paymentStat === "partially_paid" || paidAmount > 0) billStatus = "partially_paid";
      else billStatus = "pending";

      const balanceDue = Math.max(0, total - paidAmount);
      const gstRate = inferGstRate(taxableAmount, sgst, cgst, igst);
      const gstFiledBool = row.gstFiled.toLowerCase() === "yes" || row.gstFiled.toLowerCase() === "y";

      const existingBill = await db.vendorBill.findFirst({
        where: { companyId, billNumber: row.invoiceNumber },
      });

      if (existingBill) {
        if (!dryRun) {
          await db.vendorBill.update({
            where: { id: existingBill.id },
            data: {
              billDate, dueDate: dueDateBill,
              status: billStatus, taxableAmount, subtotal: taxableAmount,
              cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
              discountAmount: row.discount || 0, totalAmount: total,
              amountPaid: paidAmount, balanceDue,
              tdsApplicable: tds > 0, tdsAmount: tds,
              gstFiled: gstFiledBool,
              notes: row.remarks || existingBill.notes,
            },
          });

          await db.payment.deleteMany({
            where: { vendorBillId: existingBill.id, notes: { startsWith: "Imported from" } },
          });
          if (paidAmount > 0) {
            await db.payment.create({
              data: {
                companyId, type: "made", vendorBillId: existingBill.id, vendorId,
                paymentDate: row.paymentDate || billDate, amount: paidAmount,
                paymentMode: "bank_transfer", notes: `Imported from ${row.sheetName}`,
              },
            });
          }
        }
        result.billsUpdated++;
        continue;
      }

      if (dryRun) { result.billsCreated++; continue; }

      const bill = await db.vendorBill.create({
        data: {
          companyId, vendorId, billNumber: row.invoiceNumber,
          billDate, dueDate: dueDateBill, status: billStatus,
          subtotal: taxableAmount, discountAmount: row.discount || 0,
          taxableAmount, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
          totalAmount: total, amountPaid: paidAmount, balanceDue,
          tdsApplicable: tds > 0, tdsAmount: tds,
          gstFiled: gstFiledBool, notes: row.remarks || null,
          lines: {
            create: [{
              description: `Imported from sheet: ${row.sheetName}`,
              quantity: 1, rate: taxableAmount, taxableAmount,
              gstRate, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
              lineTotal: total,
            }],
          },
        },
      });

      if (paidAmount > 0) {
        await db.payment.create({
          data: {
            companyId, type: "made", vendorBillId: bill.id, vendorId,
            paymentDate: row.paymentDate || billDate, amount: paidAmount,
            paymentMode: "bank_transfer", notes: `Imported from ${row.sheetName}`,
          },
        });
      }
      result.billsCreated++;
    } catch (err: any) {
      result.errors.push(`Bill ${row.invoiceNumber}: ${err.message?.slice(0, 80)}`);
      result.billsSkipped++;
    }
  }

  return result;
}
