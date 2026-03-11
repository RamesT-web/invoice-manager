/**
 * Google Sheets fetch service.
 * Downloads a Google Spreadsheet as .xlsx and parses it into an XLSX WorkBook.
 */

import * as XLSX from "xlsx";

export interface GoogleCredential {
  type: "api_key";
  key: string;
}

/**
 * Fetches a Google Spreadsheet as an XLSX workbook.
 * The sheet must be shared as "Anyone with the link can view" for API key access.
 */
export async function fetchSheetAsWorkbook(
  spreadsheetId: string,
  credential: GoogleCredential
): Promise<XLSX.WorkBook> {
  // Use the Google Sheets export endpoint to download as xlsx
  // Add cache-busting param to avoid Google returning stale cached data
  const cacheBuster = Date.now();
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&_cb=${cacheBuster}`;

  const response = await fetch(exportUrl, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Spreadsheet not found. Make sure the ID is correct and the sheet is shared as "Anyone with the link can view".`
      );
    }
    if (response.status === 403) {
      throw new Error(
        `Access denied. Make sure the Google Sheet is shared as "Anyone with the link can view".`
      );
    }
    throw new Error(`Failed to fetch spreadsheet: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 100) {
    throw new Error("Downloaded file is too small — the spreadsheet may be empty or inaccessible.");
  }

  console.log(`[Google Sheets] Downloaded ${(buffer.length / 1024).toFixed(1)} KB`);

  const wb = XLSX.read(buffer, { type: "buffer" });

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error("Workbook has no sheets.");
  }

  return wb;
}

/**
 * Extracts a spreadsheet ID from a Google Sheets URL.
 * Supports URLs like:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/
 *   SPREADSHEET_ID (raw ID)
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();

  // Check if it's already a raw ID (no slashes)
  if (!trimmed.includes("/")) {
    return trimmed;
  }

  // Extract from URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1]!;
  }

  throw new Error(
    "Could not extract spreadsheet ID. Paste the full Google Sheets URL or just the spreadsheet ID."
  );
}
