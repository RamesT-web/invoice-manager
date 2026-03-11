/**
 * PDF invoice generator using pdf-lib.
 * Produces a professional GST tax invoice matching the reference layout:
 *   TE_0279_CCTV_SoftSuave.pdf
 *
 * ═══════════════════════════════════════════════════════════════
 * RENDERING CONTRACT — "Golden Template" v3 locked 2026-03-08
 * Reference: TE_0279_CCTV_SoftSuave.pdf
 * ═══════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 *   Modular renderers — each section is an independent function:
 *     renderHeader, renderInvoiceDetails, renderBillTo,
 *     renderSubjectLine, renderTable, renderTotals,
 *     renderBottomSection
 *
 *   Dynamic Y flow — every section returns the next Y position.
 *   No hardcoded Y coordinates.
 *
 *   Layout config — single source of truth for all dimensions.
 *
 * TABLE HEADER (intra-state):
 *   Non-span columns (#, Desc, HSN/SAC, Qty, Rate, Amount) span
 *   the FULL header height (span row + header row) as merged cells.
 *   Span sub-columns (CGST%, CGSTAmt, SGST%, SGSTAmt) use two rows:
 *   a span label above and sub-headers below.
 *
 * OVERFLOW PROTECTION:
 *   fitText() truncates with "..." if text exceeds column width.
 *   wrapText() word-wraps long descriptions.
 *   Rows auto-expand for multi-line descriptions.
 *   checkPage() inserts new page when space runs out.
 *   Table header repeats on every continuation page.
 * ═══════════════════════════════════════════════════════════════
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from "pdf-lib";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require("@pdf-lib/fontkit");
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Types ──────────────────────────────────────────────────

export interface PdfLineItem {
  description: string;
  hsnSac: string;
  qty: number;
  unit?: string;
  rate: number;
  taxable: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface InvoicePdfData {
  companyName: string;
  companyLegalName: string | null;
  companyGstin: string | null;
  companyPan: string | null;
  companyAddress: string;
  companyPhone: string | null;
  companyEmail: string | null;

  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply: string | null;
  terms?: string | null;
  subject?: string | null;

  customerName: string;
  customerGstin: string | null;
  customerAddress: string;

  lines: PdfLineItem[];

  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  roundOff?: number;
  balanceDue?: number;
  isInterState: boolean;

  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  bankUpi: string | null;

  notes: string | null;

  // Optional visual assets (backward-compatible, no DB changes needed)
  companyLogoBytes?: Uint8Array;
  companyLogoFormat?: 'png' | 'jpg';
  signatureStampBytes?: Uint8Array;
  signatureStampFormat?: 'png' | 'jpg';
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONFIG
// ═══════════════════════════════════════════════════════════════

const LAYOUT = {
  page: { width: 595.28, height: 841.89, margin: 40 },

  colors: {
    black: rgb(0, 0, 0),
    gray: rgb(0.4, 0.4, 0.4),
    border: rgb(0.65, 0.65, 0.65),
    white: rgb(1, 1, 1),
    headerBg: rgb(0.96, 0.96, 0.96),
  },

  fonts: {
    companyName: 15,
    taxInvoiceTitle: 22,
    sectionLabel: 10,
    sectionBody: 9,
    detailLabel: 9,
    detailValue: 9,
    tableHeader: 7.5,
    tableBody: 7,
    tableBodyBold: 7.5,
    totalsLabel: 8.5,
    totalsValue: 8.5,
    totalsBoldLabel: 10,
    totalsBoldValue: 10,
    bankLabel: 7.5,
    bankValue: 7.5,
    amountWords: 8.5,
    notesTitle: 9,
    notesBody: 8,
    subjectText: 9,
    signatureLabel: 9,
    signatureSmall: 8,
  },

  lineHeights: {
    companyName: 18,
    companyDetail: 12,
    invoiceDetail: 15,
    billToName: 14,
    billToDetail: 12,
    totalsRow: 15,
    bankDetail: 12,
    notesBody: 11,
  },

  tableIntraState: {
    columns: [
      { key: "num", header: "#", width: 20, align: "center" as const },
      { key: "desc", header: "Item & Description", width: 127.28, align: "left" as const },
      { key: "hsn", header: "HSN/SAC", width: 40, align: "center" as const },
      { key: "qty", header: "Qty", width: 32, align: "center" as const },
      { key: "unit", header: "Unit", width: 28, align: "center" as const },
      { key: "rate", header: "Rate", width: 46, align: "right" as const },
      { key: "cgstPct", header: "%", width: 24, align: "center" as const },
      { key: "cgstAmt", header: "Amt", width: 48, align: "right" as const },
      { key: "sgstPct", header: "%", width: 24, align: "center" as const },
      { key: "sgstAmt", header: "Amt", width: 48, align: "right" as const },
      { key: "amount", header: "Amount", width: 78, align: "right" as const },
    ],
    spanHeaders: [
      { label: "CGST", startCol: 6, endCol: 7 },
      { label: "SGST", startCol: 8, endCol: 9 },
    ],
  },

  tableInterState: {
    columns: [
      { key: "num", header: "#", width: 22, align: "center" as const },
      { key: "desc", header: "Item & Description", width: 152.28, align: "left" as const },
      { key: "hsn", header: "HSN/SAC", width: 48, align: "center" as const },
      { key: "qty", header: "Qty", width: 36, align: "center" as const },
      { key: "unit", header: "Unit", width: 28, align: "center" as const },
      { key: "rate", header: "Rate", width: 55, align: "right" as const },
      { key: "igstPct", header: "IGST %", width: 32, align: "center" as const },
      { key: "igstAmt", header: "IGST Amt", width: 65, align: "right" as const },
      { key: "amount", header: "Amount", width: 77, align: "right" as const },
    ],
    spanHeaders: [] as { label: string; startCol: number; endCol: number }[],
  },

  table: {
    headerHeight: 20,
    spanHeaderHeight: 14,
    cellPadding: 3,
    descriptionLineHeight: 9,
    minRowHeight: 22,
    borderWidth: 0.5,
  },

  totals: {
    blockWidth: 240,
    dividerOffset: 145,   // label cell width inside the bordered rows
    boldRowHeight: 20,
  },

  spacing: {
    headerToDetails: 10,
    sectionPadding: 7,
    tableToTotals: 10,
    totalsToBottom: 12,
  },
} as const;

const PAGE_W = LAYOUT.page.width;
const PAGE_H = LAYOUT.page.height;
const MARGIN = LAYOUT.page.margin;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ─── Helpers ────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (font.widthOfTextAtSize(text.substring(0, mid) + "...", size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.substring(0, lo) + "..." : text.charAt(0);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const neg = num < 0;
  num = Math.abs(Math.round(num));
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function two(n: number): string { if (n < 20) return ones[n] ?? ""; const t = Math.floor(n/10); const o = n%10; return (tens[t] ?? "") + (o ? " " + (ones[o] ?? "") : ""); }
  function three(n: number): string { if (n === 0) return ""; if (n < 100) return two(n); const h = Math.floor(n/100); const r = n%100; return (ones[h] ?? "") + " Hundred" + (r ? " " + two(r) : ""); }
  const parts: string[] = [];
  const cr = Math.floor(num / 10000000); num %= 10000000;
  const lk = Math.floor(num / 100000); num %= 100000;
  const th = Math.floor(num / 1000); num %= 1000;
  if (cr > 0) parts.push(three(cr) + " Crore");
  if (lk > 0) parts.push(two(lk) + " Lakh");
  if (th > 0) parts.push(two(th) + " Thousand");
  if (num > 0) parts.push(three(num));
  return (neg ? "Minus " : "") + parts.join(" ");
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let r = "Indian Rupee " + numberToWords(rupees);
  if (paise > 0) r += " and " + numberToWords(paise) + " Paise";
  return r + " Only";
}

// ─── Drawing Primitives ─────────────────────────────────────

function drawText(p: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = LAYOUT.colors.black) {
  p.drawText(text, { x, y, size, font, color });
}

function drawLine(p: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = LAYOUT.table.borderWidth, color = LAYOUT.colors.border) {
  p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

function drawRect(p: PDFPage, x: number, y: number, w: number, h: number, borderColor = LAYOUT.colors.border) {
  drawLine(p, x, y, x + w, y, LAYOUT.table.borderWidth, borderColor);
  drawLine(p, x, y + h, x + w, y + h, LAYOUT.table.borderWidth, borderColor);
  drawLine(p, x, y, x, y + h, LAYOUT.table.borderWidth, borderColor);
  drawLine(p, x + w, y, x + w, y + h, LAYOUT.table.borderWidth, borderColor);
}

function drawTextRight(p: PDFPage, text: string, rightX: number, y: number, font: PDFFont, size: number, color = LAYOUT.colors.black) {
  drawText(p, text, rightX - font.widthOfTextAtSize(text, size), y, font, size, color);
}

function drawTextCenter(p: PDFPage, text: string, cx: number, y: number, font: PDFFont, size: number, color = LAYOUT.colors.black) {
  drawText(p, text, cx - font.widthOfTextAtSize(text, size) / 2, y, font, size, color);
}

// ─── Render Context ─────────────────────────────────────────

interface RenderCtx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  fontBoldOblique: PDFFont;
  data: InvoicePdfData;
  logoImage?: PDFImage;
  stampImage?: PDFImage;
}

function checkPage(ctx: RenderCtx, needed: number): void {
  if (ctx.y - needed < MARGIN + 20) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. HEADER
// ═══════════════════════════════════════════════════════════════

function renderHeader(ctx: RenderCtx): void {
  const { page, data, fontBold, fontRegular, logoImage } = ctx;
  const startY = ctx.y;

  // Center: TAX INVOICE title
  drawTextCenter(page, "TAX INVOICE", MARGIN + CONTENT_W / 2, startY, fontBold, LAYOUT.fonts.taxInvoiceTitle);

  // Move below title with proper spacing
  let ly = startY - LAYOUT.lineHeights.companyName - 10;

  // Optional company logo (top-left, matching sample invoice placement)
  let textLeftX = MARGIN;
  let textMaxW = CONTENT_W * 0.55;
  if (logoImage) {
    const { width: drawW, height: drawH } = logoImage.scaleToFit(55, 50);
    page.drawImage(logoImage, {
      x: MARGIN,
      y: ly - drawH + LAYOUT.fonts.companyName,
      width: drawW,
      height: drawH,
    });
    textLeftX = MARGIN + drawW + 8;
    textMaxW = CONTENT_W * 0.55 - drawW - 8;
  }

  // Left: Company Name (below the TAX INVOICE title)
  const nameSize = LAYOUT.fonts.companyName;
  const companyName = data.companyLegalName || data.companyName;
  const nameLines = wrapText(companyName, fontBold, nameSize, textMaxW);
  for (const line of nameLines) {
    drawText(page, line, textLeftX, ly, fontBold, nameSize);
    ly -= LAYOUT.lineHeights.companyName;
  }

  // Address
  const ds = LAYOUT.fonts.sectionBody;
  const dlh = LAYOUT.lineHeights.companyDetail;
  if (data.companyAddress) {
    for (const segment of data.companyAddress.split("\n")) {
      for (const line of wrapText(segment, fontRegular, ds, textMaxW)) {
        drawText(page, line, textLeftX, ly, fontRegular, ds);
        ly -= dlh;
      }
    }
  }
  if (data.companyGstin) { drawText(page, `GSTIN: ${data.companyGstin}`, textLeftX, ly, fontRegular, ds); ly -= dlh; }
  const contact: string[] = [];
  if (data.companyPhone) contact.push(`Phone: ${data.companyPhone}`);
  if (data.companyEmail) contact.push(`Email: ${data.companyEmail}`);
  if (contact.length) { drawText(page, contact.join("  "), textLeftX, ly, fontRegular, ds); ly -= dlh; }

  ctx.y = ly - LAYOUT.spacing.headerToDetails;
}

// ═══════════════════════════════════════════════════════════════
// 2. INVOICE DETAILS BOX
// ═══════════════════════════════════════════════════════════════

function renderInvoiceDetails(ctx: RenderCtx): void {
  const { page, data, fontBold, fontRegular } = ctx;
  const pad = LAYOUT.spacing.sectionPadding;
  const lh = LAYOUT.lineHeights.invoiceDetail;
  const fields = [
    { l: "Invoice No", v: data.invoiceNumber },
    { l: "Invoice Date", v: data.invoiceDate },
    { l: "Due Date", v: data.dueDate },
  ];
  const boxHeight = fields.length * lh + pad * 2;

  checkPage(ctx, boxHeight + 4);
  const boxTop = ctx.y;
  const boxBot = boxTop - boxHeight;
  drawRect(page, MARGIN, boxBot, CONTENT_W, boxHeight);

  const midX = MARGIN + CONTENT_W / 2;
  drawLine(page, midX, boxTop, midX, boxBot);

  const lx = MARGIN + pad;
  const vx = MARGIN + 95;
  let ry = boxTop - pad - 10;
  for (const f of fields) {
    drawText(page, f.l, lx, ry, fontRegular, LAYOUT.fonts.detailLabel);
    drawText(page, `: ${f.v}`, vx, ry, fontBold, LAYOUT.fonts.detailValue);
    ry -= lh;
  }

  if (data.placeOfSupply) {
    const rx = midX + pad;
    const rv = midX + 105;
    drawText(page, "Place Of Supply", rx, boxTop - pad - 10, fontRegular, LAYOUT.fonts.detailLabel);
    drawText(page, `: ${data.placeOfSupply}`, rv, boxTop - pad - 10, fontBold, LAYOUT.fonts.detailValue);
  }

  ctx.y = boxBot;
}

// ═══════════════════════════════════════════════════════════════
// 3. BILL TO
// ═══════════════════════════════════════════════════════════════

function renderBillTo(ctx: RenderCtx): void {
  const { page, data, fontBold, fontRegular } = ctx;
  const pad = LAYOUT.spacing.sectionPadding;
  const ds = LAYOUT.fonts.sectionBody;
  const dlh = LAYOUT.lineHeights.billToDetail;
  const nlh = LAYOUT.lineHeights.billToName;

  let ch = 14 + nlh;
  const addrLines: string[] = [];
  if (data.customerAddress) {
    for (const segment of data.customerAddress.split("\n")) {
      addrLines.push(...wrapText(segment, fontRegular, ds, CONTENT_W - pad * 2 - 10));
    }
  }
  ch += addrLines.length * dlh;
  if (data.customerGstin) ch += dlh;
  ch += pad;
  const boxH = ch + pad;

  checkPage(ctx, boxH + 4);
  const boxTop = ctx.y;
  const boxBot = boxTop - boxH;
  drawRect(page, MARGIN, boxBot, CONTENT_W, boxH);

  let ly = boxTop - pad - 2;
  drawText(page, "Bill To", MARGIN + pad, ly, fontBold, LAYOUT.fonts.sectionLabel);
  ly -= 14;
  drawText(page, data.customerName, MARGIN + pad, ly, fontBold, LAYOUT.fonts.sectionLabel + 1);
  ly -= nlh;
  for (const line of addrLines) { drawText(page, line, MARGIN + pad, ly, fontRegular, ds); ly -= dlh; }
  if (data.customerGstin) { drawText(page, `GSTIN: ${data.customerGstin}`, MARGIN + pad, ly, fontRegular, ds); ly -= dlh; }

  ctx.y = boxBot;
}

// ═══════════════════════════════════════════════════════════════
// 4. SUBJECT LINE
// ═══════════════════════════════════════════════════════════════

function renderSubjectLine(ctx: RenderCtx): void {
  if (!ctx.data.subject) return;
  const { page, data, fontBold, fontRegular } = ctx;
  const pad = LAYOUT.spacing.sectionPadding;
  const fs = LAYOUT.fonts.subjectText;
  const labelW = fontBold.widthOfTextAtSize("Subject: ", fs);
  const lines = wrapText(data.subject!, fontRegular, fs, CONTENT_W - pad * 2 - 10);
  const ch = Math.max(lines.length, 1) * 13 + pad;

  checkPage(ctx, ch + 4);
  const boxTop = ctx.y;
  const boxBot = boxTop - ch;
  drawRect(page, MARGIN, boxBot, CONTENT_W, ch);

  let ly = boxTop - pad - 3;
  drawText(page, "Subject:", MARGIN + pad, ly, fontBold, fs);
  const tx = MARGIN + pad + labelW;
  drawText(page, lines[0] ?? "", tx, ly, fontRegular, fs);
  for (let i = 1; i < lines.length; i++) { ly -= 13; drawText(page, lines[i] ?? "", MARGIN + pad, ly, fontRegular, fs); }

  ctx.y = boxBot;
}

// ═══════════════════════════════════════════════════════════════
// 5. TABLE
// ═══════════════════════════════════════════════════════════════

type ColDef = { key: string; header: string; width: number; align: "center" | "left" | "right" };
type SpanDef = { label: string; startCol: number; endCol: number };

/** Check if column boundary `colIdx` is INTERNAL to a span (divider only in lower row) */
function isInternalSpan(colIdx: number, spans: readonly SpanDef[]): boolean {
  for (const s of spans) { if (colIdx > s.startCol && colIdx <= s.endCol) return true; }
  return false;
}

function drawTableHeader(
  ctx: RenderCtx,
  columns: readonly ColDef[],
  colX: number[],
  spans: readonly SpanDef[],
  tableRight: number,
): void {
  const { fontBold } = ctx;
  const tCfg = LAYOUT.table;
  const hasSpans = spans.length > 0;
  const fullH = hasSpans ? tCfg.spanHeaderHeight + tCfg.headerHeight : tCfg.headerHeight;
  const headerTop = ctx.y;
  const headerBot = headerTop - fullH;
  const spanDivY = hasSpans ? headerTop - tCfg.spanHeaderHeight : headerTop;

  // Background fill for entire header area
  ctx.page.drawRectangle({
    x: MARGIN + 0.25, y: headerBot, width: tableRight - MARGIN - 0.5, height: fullH,
    color: LAYOUT.colors.headerBg,
  });

  // Outer border
  drawLine(ctx.page, MARGIN, headerTop, tableRight, headerTop);
  drawLine(ctx.page, MARGIN, headerBot, tableRight, headerBot);
  drawLine(ctx.page, MARGIN, headerTop, MARGIN, headerBot);
  drawLine(ctx.page, tableRight, headerTop, tableRight, headerBot);

  // Vertical column dividers
  for (let i = 1; i < columns.length; i++) {
    const x = colX[i]!;
    if (isInternalSpan(i, spans)) {
      // Internal span sub-column: divider only in lower row
      drawLine(ctx.page, x, spanDivY, x, headerBot);
    } else {
      // Non-span or span boundary: full height divider
      drawLine(ctx.page, x, headerTop, x, headerBot);
    }
  }

  // Span horizontal divider (only under spanned columns)
  if (hasSpans) {
    for (const span of spans) {
      const sLeft = colX[span.startCol]!;
      const sRight = colX[span.endCol]! + columns[span.endCol]!.width;
      drawLine(ctx.page, sLeft, spanDivY, sRight, spanDivY);

      // Span label centered in span row
      const sCenterX = (sLeft + sRight) / 2;
      const spanTextY = spanDivY + (tCfg.spanHeaderHeight - LAYOUT.fonts.tableHeader) / 2;
      drawTextCenter(ctx.page, span.label, sCenterX, spanTextY, fontBold, LAYOUT.fonts.tableHeader);
    }
  }

  // Column header text
  const hdrFontSize = LAYOUT.fonts.tableHeader;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    const cx = colX[i]!;
    const cRight = cx + col.width;
    const cCenter = cx + col.width / 2;

    if (isInternalSpan(i, spans) || (hasSpans && spans.some(s => i >= s.startCol && i <= s.endCol))) {
      // Spanned column: text centered in LOWER row only
      const textY = headerBot + (tCfg.headerHeight - hdrFontSize) / 2;
      if (col.align === "right") drawTextRight(ctx.page, col.header, cRight - tCfg.cellPadding, textY, fontBold, hdrFontSize);
      else drawTextCenter(ctx.page, col.header, cCenter, textY, fontBold, hdrFontSize);
    } else {
      // Non-span column: text centered in FULL height (merged cell)
      if (col.key === "hsn" && hasSpans) {
        // Special: HSN/SAC as two lines
        const line1Y = headerBot + fullH * 0.6;
        const line2Y = headerBot + fullH * 0.28;
        drawTextCenter(ctx.page, "HSN", cCenter, line1Y, fontBold, hdrFontSize);
        drawTextCenter(ctx.page, "/SAC", cCenter, line2Y, fontBold, hdrFontSize);
      } else {
        const textY = headerBot + (fullH - hdrFontSize) / 2;
        if (col.align === "right") drawTextRight(ctx.page, col.header, cRight - tCfg.cellPadding, textY, fontBold, hdrFontSize);
        else if (col.align === "left") drawText(ctx.page, col.header, cx + tCfg.cellPadding, textY, fontBold, hdrFontSize);
        else drawTextCenter(ctx.page, col.header, cCenter, textY, fontBold, hdrFontSize);
      }
    }
  }

  ctx.y = headerBot;
}

function renderTable(ctx: RenderCtx): void {
  const { data, fontBold, fontRegular } = ctx;
  const tCfg = LAYOUT.table;
  const colDefs = data.isInterState ? LAYOUT.tableInterState : LAYOUT.tableIntraState;
  const columns = colDefs.columns;
  const spans = colDefs.spanHeaders;

  const colX: number[] = [];
  let cx = MARGIN;
  for (const c of columns) { colX.push(cx); cx += c.width; }
  const tableRight = cx;

  const hasSpans = spans.length > 0;
  const fullHeaderH = (hasSpans ? tCfg.spanHeaderHeight : 0) + tCfg.headerHeight;
  checkPage(ctx, fullHeaderH + tCfg.minRowHeight + 10);
  drawTableHeader(ctx, columns, colX, spans, tableRight);

  // Data rows
  for (let ri = 0; ri < data.lines.length; ri++) {
    const line = data.lines[ri]!;
    const descW = columns[1]!.width - tCfg.cellPadding * 2;
    const descParts = line.description.split("\n");
    const titleLines = wrapText(descParts[0] || "", fontBold, LAYOUT.fonts.tableBodyBold, descW);
    const detailText = descParts.slice(1).join(" ");
    const detailLines = detailText ? wrapText(detailText, fontRegular, LAYOUT.fonts.tableBody, descW) : [];
    const descLineCount = titleLines.length + detailLines.length;
    const rowH = Math.max(tCfg.minRowHeight, descLineCount * tCfg.descriptionLineHeight + tCfg.cellPadding * 2 + 2);

    // Page break with header repeat
    if (ctx.y - rowH - 4 < MARGIN + 20) {
      ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
      ctx.y = PAGE_H - MARGIN;
      drawTableHeader(ctx, columns, colX, spans, tableRight);
    }

    const rowTop = ctx.y;
    const rowBot = rowTop - rowH;

    // Borders
    drawLine(ctx.page, MARGIN, rowTop, MARGIN, rowBot);
    drawLine(ctx.page, tableRight, rowTop, tableRight, rowBot);
    for (let i = 1; i < columns.length; i++) drawLine(ctx.page, colX[i]!, rowTop, colX[i]!, rowBot);
    drawLine(ctx.page, MARGIN, rowBot, tableRight, rowBot);

    const textY = rowTop - tCfg.cellPadding - LAYOUT.fonts.tableBody - 2;

    // #
    drawTextCenter(ctx.page, String(ri + 1), colX[0]! + columns[0]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);

    // Description
    let dy = textY;
    const dx = colX[1]! + tCfg.cellPadding;
    for (const tl of titleLines) { drawText(ctx.page, fitText(tl, fontBold, LAYOUT.fonts.tableBodyBold, descW), dx, dy, fontBold, LAYOUT.fonts.tableBodyBold); dy -= tCfg.descriptionLineHeight; }
    for (const dl of detailLines) { drawText(ctx.page, fitText(dl, fontRegular, LAYOUT.fonts.tableBody, descW), dx, dy, fontRegular, LAYOUT.fonts.tableBody); dy -= tCfg.descriptionLineHeight; }

    // HSN/SAC
    drawTextCenter(ctx.page, fitText(line.hsnSac || "-", fontRegular, LAYOUT.fonts.tableBody, columns[2]!.width - 6), colX[2]! + columns[2]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);

    // Qty
    drawTextCenter(ctx.page, fitText(fmt(line.qty).replace(".00", ""), fontRegular, LAYOUT.fonts.tableBody, columns[3]!.width - 6), colX[3]! + columns[3]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);

    // Unit
    drawTextCenter(ctx.page, fitText(line.unit || "", fontRegular, LAYOUT.fonts.tableBody, columns[4]!.width - 6), colX[4]! + columns[4]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);

    // Rate
    drawTextRight(ctx.page, fitText(fmt(line.rate), fontRegular, LAYOUT.fonts.tableBody, columns[5]!.width - 6), colX[5]! + columns[5]!.width - tCfg.cellPadding, textY, fontRegular, LAYOUT.fonts.tableBody);

    if (data.isInterState) {
      drawTextCenter(ctx.page, `${line.gstRate}%`, colX[6]! + columns[6]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);
      drawTextRight(ctx.page, fmt(line.gstAmount), colX[7]! + columns[7]!.width - tCfg.cellPadding, textY, fontRegular, LAYOUT.fonts.tableBody);
      drawTextRight(ctx.page, fmt(line.total), colX[8]! + columns[8]!.width - tCfg.cellPadding, textY, fontRegular, LAYOUT.fonts.tableBody);
    } else {
      const hRate = line.gstRate / 2;
      const hAmt = line.gstAmount / 2;
      drawTextCenter(ctx.page, `${hRate}%`, colX[6]! + columns[6]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);
      drawTextRight(ctx.page, fmt(hAmt), colX[7]! + columns[7]!.width - tCfg.cellPadding, textY, fontRegular, LAYOUT.fonts.tableBody);
      drawTextCenter(ctx.page, `${hRate}%`, colX[8]! + columns[8]!.width / 2, textY, fontRegular, LAYOUT.fonts.tableBody);
      drawTextRight(ctx.page, fmt(hAmt), colX[9]! + columns[9]!.width - tCfg.cellPadding, textY, fontRegular, LAYOUT.fonts.tableBody);
      drawTextRight(ctx.page, fmt(line.total), colX[10]! + columns[10]!.width - tCfg.cellPadding, textY, fontRegular, LAYOUT.fonts.tableBody);
    }

    ctx.y = rowBot;
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. TOTALS
// ═══════════════════════════════════════════════════════════════

function renderTotals(ctx: RenderCtx): void {
  const { data, fontBold, fontRegular } = ctx;
  const lh = LAYOUT.lineHeights.totalsRow;
  const tc = LAYOUT.totals;

  // Build regular (non-bordered) rows
  const plainRows: { label: string; value: string }[] = [];
  plainRows.push({ label: "Sub Total", value: fmt(data.subtotal) });

  const rates = data.lines.map(l => l.gstRate);
  const uniform =
  rates.length > 0 &&
  rates.every(r => r === rates[0])
    ? rates[0]
    : null;
  if (data.isInterState) {
    plainRows.push({ label: uniform !== null ? `IGST ${uniform}% (${uniform}%)` : "IGST", value: fmt(data.igst) });
  } else {
    if (uniform !== null) {
      const h = uniform / 2;
      plainRows.push({ label: `CGST ${h}% (${h}%)`, value: fmt(data.cgst) });
      plainRows.push({ label: `SGST ${h}% (${h}%)`, value: fmt(data.sgst) });
    } else {
      plainRows.push({ label: "CGST", value: fmt(data.cgst) });
      plainRows.push({ label: "SGST", value: fmt(data.sgst) });
    }
  }

  const roundOff = data.roundOff ?? 0;
  if (roundOff !== 0) {
    plainRows.push({ label: "Round Off", value: `${roundOff >= 0 ? "+" : ""}${fmt(roundOff)}` });
  }

  // Build bordered rows (Total, Balance Due)
  const boldRows: { label: string; value: string }[] = [
    { label: "Total", value: `\u20B9${fmt(data.totalAmount)}` },
    { label: "Balance Due", value: `\u20B9${fmt(data.balanceDue ?? data.totalAmount)}` },
  ];

  const totalHeight = plainRows.length * lh + boldRows.length * tc.boldRowHeight + LAYOUT.spacing.tableToTotals + 5;
  checkPage(ctx, totalHeight + 10);

  ctx.y -= LAYOUT.spacing.tableToTotals;

  // Right-aligned block positioning
  const blockLeft = MARGIN + CONTENT_W - tc.blockWidth;
  const blockRight = MARGIN + CONTENT_W;
  const dividerX = blockLeft + tc.dividerOffset;

  // Plain rows
  let ry = ctx.y;
  for (const row of plainRows) {
    drawTextRight(ctx.page, row.label, dividerX - 8, ry, fontRegular, LAYOUT.fonts.totalsLabel);
    drawTextRight(ctx.page, row.value, blockRight - 5, ry, fontRegular, LAYOUT.fonts.totalsValue);
    ry -= lh;
  }

  // Bordered rows (Total, Balance Due) — mini-table
  ry -= 2;
  let cellTop = ry + LAYOUT.fonts.totalsBoldLabel + 6;
  for (const row of boldRows) {
    const cellBot = cellTop - tc.boldRowHeight;

    // Cell borders
    drawRect(ctx.page, blockLeft, cellBot, tc.blockWidth, tc.boldRowHeight);
    drawLine(ctx.page, dividerX, cellTop, dividerX, cellBot);

    // Text centered vertically in cell
    const textY = cellBot + (tc.boldRowHeight - LAYOUT.fonts.totalsBoldLabel) / 2;
    drawText(ctx.page, row.label, blockLeft + 8, textY, fontBold, LAYOUT.fonts.totalsBoldLabel);
    drawTextRight(ctx.page, row.value, blockRight - 8, textY, fontBold, LAYOUT.fonts.totalsBoldValue);

    cellTop = cellBot;
    ry = cellBot;
  }

  ctx.y = ry - LAYOUT.spacing.totalsToBottom;
}

// ═══════════════════════════════════════════════════════════════
// 7. BOTTOM SECTION (two-column: words+notes+bank | signature)
// ═══════════════════════════════════════════════════════════════

function renderBottomSection(ctx: RenderCtx): void {
  const { page, data, fontBold, fontBoldOblique, fontRegular } = ctx;
  const pad = LAYOUT.spacing.sectionPadding;

  // Pre-compute content heights
  const leftMaxW = CONTENT_W * 0.55;
  const wordsLines = wrapText(amountInWords(data.totalAmount), fontBoldOblique, LAYOUT.fonts.amountWords, leftMaxW);

  // Parse notes into numbered lines if they come as a single block
  let notesList: string[] = [];
  if (data.notes) {
    // Split by numbered prefixes like "1." or by newlines
    const raw = data.notes.split(/\n/).map(s => s.trim()).filter(Boolean);
    notesList = raw;
  }
  const notesWrapped: string[] = [];
  for (const n of notesList) {
    for (const wl of wrapText(n, fontRegular, LAYOUT.fonts.notesBody, leftMaxW)) {
      notesWrapped.push(wl);
    }
  }

  // Bank details fields
  const bankFields = [
    { l: "Bank Name", v: data.bankName },
    { l: "A/C No", v: data.bankAccount },
    { l: "IFSC Code", v: data.bankIfsc },
    { l: "Branch", v: data.bankBranch },
    ...(data.bankUpi ? [{ l: "UPI", v: data.bankUpi }] : []),
  ].filter(f => f.v);

  let leftH = 14 + wordsLines.length * 13; // Total In Words
  if (notesWrapped.length) leftH += 10 + 14 + notesWrapped.length * LAYOUT.lineHeights.notesBody;
  if (bankFields.length) leftH += 14 + 14 + bankFields.length * LAYOUT.lineHeights.bankDetail;

  const neededH = Math.max(leftH + 80, 200);
  checkPage(ctx, neededH);

  // Separator line
  drawLine(page, MARGIN, ctx.y, MARGIN + CONTENT_W, ctx.y);

  const sectionTop = ctx.y - 8;
  const leftX = MARGIN + pad;
  const rightEdge = MARGIN + CONTENT_W - pad;

  // ── LEFT COLUMN: Amount in Words → Notes → Bank Details ──
  let ly = sectionTop;

  // Total In Words
  drawText(page, "Total In Words:", leftX, ly, fontBold, LAYOUT.fonts.amountWords);
  ly -= 14;
  for (const wl of wordsLines) {
    drawText(page, wl, leftX, ly, fontBoldOblique, LAYOUT.fonts.amountWords);
    ly -= 13;
  }

  // Notes (left side, below amount in words)
  if (notesWrapped.length) {
    ly -= 10;
    drawText(page, "Notes", leftX, ly, fontBold, LAYOUT.fonts.notesTitle);
    ly -= 14;
    for (const nl of notesWrapped) {
      drawText(page, nl, leftX, ly, fontRegular, LAYOUT.fonts.notesBody);
      ly -= LAYOUT.lineHeights.notesBody;
    }
  }

  // Bank Details (LEFT side, below notes)
  if (bankFields.length) {
    ly -= 14;
    drawText(page, "Bank Details", leftX, ly, fontBold, LAYOUT.fonts.notesTitle);
    ly -= 14;

    const labelColW = 65;
    for (const f of bankFields) {
      drawText(page, f.l, leftX, ly, fontBold, LAYOUT.fonts.bankLabel);
      drawText(page, `:  ${f.v}`, leftX + labelColW, ly, fontRegular, LAYOUT.fonts.bankValue);
      ly -= LAYOUT.lineHeights.bankDetail;
    }
  }

  // ── RIGHT COLUMN: "For Company" + Signature (with more spacing) ──
  const companyName = data.companyLegalName || data.companyName;
  // Position "For Company" lower — offset from section top
  const forCompanyY = sectionTop - 20;
  drawTextRight(page, `For ${companyName}`, rightEdge, forCompanyY, fontBold, LAYOUT.fonts.signatureLabel);

  // "Authorised Signature" placed well below "For..." with space for stamp
  const signatureY = forCompanyY - 55;
  if (ctx.stampImage) {
    const { width: drawW, height: drawH } = ctx.stampImage.scaleToFit(120, 45);
    const stampX = rightEdge - drawW;
    const stampY = signatureY + 8;
    page.drawImage(ctx.stampImage, { x: stampX, y: stampY, width: drawW, height: drawH });
    drawTextRight(page, "Authorised Signature", rightEdge, stampY - 8, fontRegular, LAYOUT.fonts.signatureSmall);
  } else {
    drawTextRight(page, "Authorised Signature", rightEdge, signatureY, fontRegular, LAYOUT.fonts.signatureSmall);
  }

  ctx.y = Math.min(ly, signatureY - 10);
}

// ═══════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════

/** Try to locate a system font that supports the ₹ glyph (Windows/Linux/Mac). */
function findSystemFont(style: "regular" | "bold" | "bolditalic"): Buffer | null {
  const candidates: Record<string, string[]> = {
    regular: [
      "C:/Windows/Fonts/arial.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      "/System/Library/Fonts/Helvetica.ttc",
    ],
    bold: [
      "C:/Windows/Fonts/arialbd.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
      "/System/Library/Fonts/Helvetica.ttc",
    ],
    bolditalic: [
      "C:/Windows/Fonts/arialbi.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf",
      "/System/Library/Fonts/Helvetica.ttc",
    ],
  };
  for (const p of candidates[style]) {
    if (existsSync(p)) {
      try { return readFileSync(p); } catch { /* skip */ }
    }
  }
  return null;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();

  // Register fontkit so we can embed TTF/OTF fonts that support ₹ (U+20B9)
  doc.registerFontkit(fontkit);

  const regularBytes = findSystemFont("regular");
  const boldBytes = findSystemFont("bold");
  const boldItalicBytes = findSystemFont("bolditalic");

  let fontRegular: PDFFont;
  let fontBold: PDFFont;
  let fontBoldOblique: PDFFont;

  if (regularBytes && boldBytes && boldItalicBytes) {
    fontRegular = await doc.embedFont(regularBytes);
    fontBold = await doc.embedFont(boldBytes);
    fontBoldOblique = await doc.embedFont(boldItalicBytes);
  } else {
    // Fallback: standard fonts (₹ will be replaced with "Rs." at render time)
    fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    fontBoldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  }

  // Embed optional visual assets (backward-compatible — skip silently on bad data)
  let logoImage: PDFImage | undefined;
  if (data.companyLogoBytes) {
    try {
      logoImage = data.companyLogoFormat === 'jpg'
        ? await doc.embedJpg(data.companyLogoBytes)
        : await doc.embedPng(data.companyLogoBytes);
    } catch { /* invalid image data — fall back to text-only header */ }
  }
  let stampImage: PDFImage | undefined;
  if (data.signatureStampBytes) {
    try {
      stampImage = data.signatureStampFormat === 'jpg'
        ? await doc.embedJpg(data.signatureStampBytes)
        : await doc.embedPng(data.signatureStampBytes);
    } catch { /* invalid image data — fall back to text-only signature */ }
  }

  const ctx: RenderCtx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    fontRegular, fontBold, fontBoldOblique, data,
    logoImage, stampImage,
  };

  renderHeader(ctx);
  renderInvoiceDetails(ctx);
  renderBillTo(ctx);
  renderSubjectLine(ctx);
  renderTable(ctx);
  renderTotals(ctx);
  renderBottomSection(ctx);

  return Buffer.from(await doc.save());
}
