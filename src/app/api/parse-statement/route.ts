import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    let headers: string[] = [];
    let rows: string[][] = [];

    if (ext === "csv") {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        return NextResponse.json({ error: "File has fewer than 2 rows" }, { status: 400 });
      }

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      headers = parseLine(lines[0]);
      rows = lines.slice(1).map(parseLine).filter((r) => r.length >= 3);
    } else {
      // Excel file
      const buffer = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      if (!firstSheet) {
        return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });
      }

      const data: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        raw: false,
        defval: "",
      });

      if (data.length < 2) {
        return NextResponse.json({ error: "File has fewer than 2 rows" }, { status: 400 });
      }

      // Find header row — look for the row with the most banking-related keywords
      const bankKeywords = [
        "date", "txn date", "transaction date", "value date", "posting date",
        "narration", "description", "particular", "details", "remark",
        "debit", "credit", "withdrawal", "deposit",
        "balance", "closing balance", "running balance",
        "amount", "chq", "cheque", "ref", "reference", "utr",
      ];

      let headerIdx = 0;
      let bestScore = 0;

      for (let i = 0; i < Math.min(data.length, 20); i++) {
        const row = data[i];
        if (!row) continue;
        const nonEmpty = row.filter((c) => c && c.toString().trim()).length;
        if (nonEmpty < 3) continue;

        let score = 0;
        for (const cell of row) {
          const val = (cell ?? "").toString().trim().toLowerCase();
          if (!val) continue;
          for (const kw of bankKeywords) {
            if (val.includes(kw)) {
              score += 10;
              break;
            }
          }
        }

        // Bonus for having both a date-like AND an amount-like keyword
        const rowLower = row.map((c) => (c ?? "").toString().trim().toLowerCase());
        const hasDate = rowLower.some((c) => c.includes("date"));
        const hasAmount = rowLower.some((c) =>
          ["debit", "credit", "withdrawal", "deposit", "amount"].some((k) => c.includes(k))
        );
        if (hasDate && hasAmount) score += 20;

        if (score > bestScore) {
          bestScore = score;
          headerIdx = i;
        }
      }

      // Fallback: if no keyword-based header found, use first row with 3+ non-empty cells
      if (bestScore === 0) {
        for (let i = 0; i < Math.min(data.length, 10); i++) {
          const nonEmpty = data[i].filter((c) => c && c.toString().trim()).length;
          if (nonEmpty >= 3) {
            headerIdx = i;
            break;
          }
        }
      }

      headers = data[headerIdx].map((h) => (h ?? "").toString().trim());
      rows = data
        .slice(headerIdx + 1)
        .map((row) => row.map((cell) => (cell ?? "").toString().trim()))
        .filter((r) => r.filter((c) => c).length >= 3);
    }

    // ─── Normalize: detect "single amount + Cr/Dr indicator" format ───
    // Many Indian bank statements (ICICI, HDFC, etc.) have:
    //   Cr/Dr | Transaction Amount | Balance
    // Instead of separate Debit/Credit columns.
    // We split the single amount into Debit & Credit for the client.
    const headersLower = headers.map((h) => h.toLowerCase());

    // Find Cr/Dr indicator column
    const crDrIdx = headersLower.findIndex((h) =>
      h === "cr/dr" || h === "dr/cr" || h === "cr / dr" || h === "dr / cr" ||
      h === "type" || h === "transaction type"
    );

    // Check if separate Debit/Credit columns exist (use word-boundary-like matching)
    // Avoid false positives: "description" contains "cr", so substring matching is not safe
    const debitCreditKeywords = ["debit", "withdrawal", "deposit"];
    const hasDebitCol = headersLower.some((h) => {
      if (h.includes("debit") || h.includes("withdrawal")) return true;
      // Only match standalone "dr" (e.g., "Dr", "Dr.", "DR Amount") not "address", "andra"
      if (/\bdr\b/.test(h) && !/cr/.test(h)) return true;
      return false;
    });
    const hasCreditCol = headersLower.some((h) => {
      if (h.includes("credit") || h.includes("deposit")) return true;
      // Only match standalone "cr" (e.g., "Cr", "Cr.", "CR Amount") not "description", "accrual"
      if (/\bcr\b/.test(h) && !/dr/.test(h)) return true;
      return false;
    });

    // Find single "amount" column
    const amountIdx = headersLower.findIndex((h) =>
      h.includes("amount") || h.includes("transaction amount")
    );

    if (crDrIdx >= 0 && amountIdx >= 0 && !hasDebitCol && !hasCreditCol) {
      // This is a single-amount format — split into Debit & Credit
      // Replace the Cr/Dr column with "Debit" and the Amount column with "Credit"
      // and adjust row data accordingly

      const newHeaders = headers.filter((_, i) => i !== crDrIdx);
      // Find the amount column index in the new array (shifted if crDr was before it)
      const newAmountIdx = amountIdx > crDrIdx ? amountIdx - 1 : amountIdx;

      // Replace the amount header with "Debit" and insert "Credit" after it
      newHeaders[newAmountIdx] = "Debit";
      newHeaders.splice(newAmountIdx + 1, 0, "Credit");

      const newRows = rows.map((row) => {
        const crDrVal = (row[crDrIdx] ?? "").toUpperCase().trim();
        const amountVal = row[amountIdx] ?? "0";

        // Remove the Cr/Dr column
        const newRow = row.filter((_, i) => i !== crDrIdx);

        // Determine if debit or credit
        const isCredit = crDrVal === "CR" || crDrVal === "CR." || crDrVal === "C" || crDrVal === "CREDIT";

        if (isCredit) {
          // Amount goes to Credit column, Debit = 0
          newRow[newAmountIdx] = "0";
          newRow.splice(newAmountIdx + 1, 0, amountVal);
        } else {
          // Amount stays in Debit column, Credit = 0
          newRow[newAmountIdx] = amountVal;
          newRow.splice(newAmountIdx + 1, 0, "0");
        }

        return newRow;
      });

      headers = newHeaders;
      rows = newRows;
    }

    // ─── Remove trailing empty columns ───
    // Some bank exports have 100+ empty trailing columns
    const maxUsedCol = headers.reduce((max, h, i) => (h ? i : max), 0);
    const balanceIdx = headersLower.findIndex((h) => h.includes("balance"));
    const trimTo = Math.max(maxUsedCol, balanceIdx >= 0 ? balanceIdx : 0) + 1;
    if (trimTo < headers.length) {
      headers = headers.slice(0, trimTo);
      rows = rows.map((r) => r.slice(0, trimTo));
    }

    // ─── Filter out summary/total rows ───
    rows = rows.filter((row) => {
      const joined = row.join(" ").toLowerCase();
      return !joined.includes("opening balance") &&
        !joined.includes("closing balance") &&
        !joined.includes("statement summary") &&
        !joined.includes("grand total");
    });

    return NextResponse.json({ headers, rows });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
