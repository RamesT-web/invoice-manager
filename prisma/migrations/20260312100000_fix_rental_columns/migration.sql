-- Fix: add missing columns/indexes from partially-applied 20260312080000_add_rental_invoicing
-- Uses IF NOT EXISTS guards so it's safe to run even if some parts already exist.

-- Add missing columns to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "rental_month" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_run_id" UUID;

-- Create indexes IF NOT EXISTS
CREATE INDEX IF NOT EXISTS "invoice_runs_company_id_month_idx" ON "invoice_runs"("company_id", "month");

-- Create partial unique index IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_company_id_customer_id_rental_month_key" ON "invoices"("company_id", "customer_id", "rental_month") WHERE "rental_month" IS NOT NULL;

-- Add foreign keys IF NOT EXISTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_runs_company_id_fkey') THEN
    ALTER TABLE "invoice_runs" ADD CONSTRAINT "invoice_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_invoice_run_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_run_id_fkey" FOREIGN KEY ("invoice_run_id") REFERENCES "invoice_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
