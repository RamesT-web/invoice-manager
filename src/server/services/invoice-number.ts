import { PrismaClient } from "@prisma/client";

/**
 * Generate the next invoice number and atomically increment the counter.
 * Format: {prefix}{FY}/{serial} e.g. TES/2024-25/001
 */
export async function generateInvoiceNumber(
  db: PrismaClient,
  companyId: string
): Promise<string> {
  const company = await db.company.update({
    where: { id: companyId },
    data: { invoiceNextNumber: { increment: 1 } },
    select: {
      invoicePrefix: true,
      invoiceNextNumber: true,
      financialYearStart: true,
    },
  });

  // The number returned is already incremented, so the invoice # is (n - 1)
  const serial = company.invoiceNextNumber - 1;
  const fy = getFinancialYear(parseInt(company.financialYearStart));
  const paddedSerial = String(serial).padStart(3, "0");

  return `${company.invoicePrefix}${fy}/${paddedSerial}`;
}

/** Get financial year string like "2024-25" based on start month */
function getFinancialYear(startMonth: number): string {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  let fyStartYear: number;
  if (currentMonth >= startMonth) {
    fyStartYear = currentYear;
  } else {
    fyStartYear = currentYear - 1;
  }

  const fyEndYear = fyStartYear + 1;
  return `${fyStartYear}-${String(fyEndYear).slice(2)}`;
}
