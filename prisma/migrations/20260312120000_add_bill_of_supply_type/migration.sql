-- AlterTable: Add invoice_type to invoices
ALTER TABLE "invoices" ADD COLUMN "invoice_type" TEXT NOT NULL DEFAULT 'invoice';

-- AlterTable: Add bos_prefix and bos_next_number to companies
ALTER TABLE "companies" ADD COLUMN "bos_prefix" TEXT NOT NULL DEFAULT 'BOS/';
ALTER TABLE "companies" ADD COLUMN "bos_next_number" INT NOT NULL DEFAULT 1;

-- Classify existing BOS records
UPDATE "invoices" SET "invoice_type" = 'bill_of_supply' WHERE "invoice_number" LIKE 'BOS%';

-- CreateIndex
CREATE INDEX "invoices_company_id_invoice_type_idx" ON "invoices"("company_id", "invoice_type");
