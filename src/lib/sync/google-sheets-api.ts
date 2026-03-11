/**
 * Google Sheets API integration using service account credentials.
 * Reads Clients_Master, Charges_Monthly tabs and writes to Invoice_Register.
 */

import { google, sheets_v4 } from "googleapis";

// ─── Types ──────────────────────────────────────────────────

export interface RentalClient {
  clientId: string;
  clientName: string;
  gstin: string | null;
  pan: string | null;
  billingAddress: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  email: string | null;
  phone: string | null;
  placeOfSupply: string | null;
  status: string; // Active / Inactive
}

export interface MonthlyCharge {
  clientId: string;
  month: string; // "2026-03"
  rentBase: number;
  maintenance: number;
  eb: number;
  dg: number;
  otherCharges: number;
  otherDescription: string | null;
  gstPercent: number;
}

export interface InvoiceRegisterRow {
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  month: string;
  taxable: number;
  gst: number;
  total: number;
  status: string;
  pdfLink: string;
  errorMessage: string;
  generatedAt: string;
}

// ─── Auth ───────────────────────────────────────────────────

function getSheetsClient(): sheets_v4.Sheets {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
  }

  const creds = JSON.parse(credJson);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

// ─── Helpers ────────────────────────────────────────────────

function str(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  return String(val).trim();
}

function num(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── Read Clients_Master ────────────────────────────────────

export async function readClientsSheet(
  spreadsheetId: string
): Promise<RentalClient[]> {
  const sheets = getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Clients_Master!A:L",
  });

  const rows = resp.data.values;
  if (!rows || rows.length < 2) return [];

  // Skip header row
  return rows.slice(1)
    .filter((row) => str(row[0]) && str(row[1]))
    .map((row) => ({
      clientId: str(row[0]),
      clientName: str(row[1]),
      gstin: str(row[2]) || null,
      pan: str(row[3]) || null,
      billingAddress: str(row[4]) || null,
      city: str(row[5]) || null,
      state: str(row[6]) || null,
      pincode: str(row[7]) || null,
      email: str(row[8]) || null,
      phone: str(row[9]) || null,
      placeOfSupply: str(row[10]) || null,
      status: str(row[11]) || "Active",
    }));
}

// ─── Read Charges_Monthly ───────────────────────────────────

export async function readChargesSheet(
  spreadsheetId: string,
  month: string
): Promise<MonthlyCharge[]> {
  const sheets = getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Charges_Monthly!A:I",
  });

  const rows = resp.data.values;
  if (!rows || rows.length < 2) return [];

  return rows.slice(1)
    .filter((row) => str(row[0]) && str(row[1]))
    .filter((row) => str(row[1]) === month)
    .map((row) => ({
      clientId: str(row[0]),
      month: str(row[1]),
      rentBase: num(row[2]),
      maintenance: num(row[3]),
      eb: num(row[4]),
      dg: num(row[5]),
      otherCharges: num(row[6]),
      otherDescription: str(row[7]) || null,
      gstPercent: num(row[8]) || 18,
    }));
}

// ─── Write Invoice_Register ─────────────────────────────────

export async function writeInvoiceRegister(
  spreadsheetId: string,
  rows: InvoiceRegisterRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const sheets = getSheetsClient();

  // Ensure the Invoice_Register sheet exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = spreadsheet.data.sheets?.map(
    (s) => s.properties?.title
  ) ?? [];

  if (!sheetNames.includes("Invoice_Register")) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: "Invoice_Register" },
            },
          },
        ],
      },
    });

    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Invoice_Register!A1:K1",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "InvoiceNumber", "ClientID", "ClientName", "Month",
          "Taxable", "GST", "Total", "Status",
          "PDFLink", "ErrorMessage", "GeneratedAt",
        ]],
      },
    });
  }

  // Append data rows
  const dataRows = rows.map((r) => [
    r.invoiceNumber,
    r.clientId,
    r.clientName,
    r.month,
    r.taxable,
    r.gst,
    r.total,
    r.status,
    r.pdfLink,
    r.errorMessage,
    r.generatedAt,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Invoice_Register!A:K",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: dataRows },
  });
}
