/**
 * GST calculation engine.
 *
 * Rules:
 * - If supplier state === place of supply (customer state) → intra-state → CGST + SGST (50% each)
 * - If supplier state !== place of supply → inter-state → IGST (100%)
 */

export interface LineItemInput {
  quantity: number;
  rate: number;
  gstRate: number;
  discountType?: "percentage" | "fixed" | null;
  discountValue?: number | null;
}

export interface LineItemCalc {
  amount: number; // qty * rate
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

/** Calculate GST for a single line item */
export function calcLineItem(
  item: LineItemInput,
  isInterState: boolean
): LineItemCalc {
  const amount = round(item.quantity * item.rate);

  let discountAmount = 0;
  if (item.discountType === "percentage" && item.discountValue) {
    discountAmount = round(amount * item.discountValue / 100);
  } else if (item.discountType === "fixed" && item.discountValue) {
    discountAmount = round(item.discountValue);
  }

  const taxableAmount = round(amount - discountAmount);
  const gstAmount = round(taxableAmount * item.gstRate / 100);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = gstAmount;
  } else {
    cgstAmount = round(gstAmount / 2);
    sgstAmount = round(gstAmount - cgstAmount); // avoids rounding mismatch
  }

  const lineTotal = round(taxableAmount + gstAmount);

  return {
    amount,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineTotal,
  };
}

/** Calculate invoice-level totals from line items */
export function calcInvoiceTotals(lines: LineItemCalc[]): InvoiceTotals {
  const subtotal = round(lines.reduce((s, l) => s + l.amount, 0));
  const discountAmount = round(lines.reduce((s, l) => s + l.discountAmount, 0));
  const taxableAmount = round(lines.reduce((s, l) => s + l.taxableAmount, 0));
  const cgstAmount = round(lines.reduce((s, l) => s + l.cgstAmount, 0));
  const sgstAmount = round(lines.reduce((s, l) => s + l.sgstAmount, 0));
  const igstAmount = round(lines.reduce((s, l) => s + l.igstAmount, 0));
  const totalAmount = round(taxableAmount + cgstAmount + sgstAmount + igstAmount);

  return { subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, totalAmount };
}

/** Determine if transaction is inter-state */
export function isInterState(supplierStateCode: string | null | undefined, customerStateCode: string | null | undefined): boolean {
  if (!supplierStateCode || !customerStateCode) return false;
  return supplierStateCode !== customerStateCode;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
