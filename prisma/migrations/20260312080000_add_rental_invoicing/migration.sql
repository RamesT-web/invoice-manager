-- CreateTable
CREATE TABLE "invoice_runs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "total_clients" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add rental columns to invoices
ALTER TABLE "invoices" ADD COLUMN "rental_month" TEXT;
ALTER TABLE "invoices" ADD COLUMN "invoice_run_id" UUID;

-- CreateIndex
CREATE INDEX "invoice_runs_company_id_month_idx" ON "invoice_runs"("company_id", "month");

-- CreateIndex (unique constraint for rental dedup)
CREATE UNIQUE INDEX "invoices_company_id_customer_id_rental_month_key" ON "invoices"("company_id", "customer_id", "rental_month");

-- AddForeignKey
ALTER TABLE "invoice_runs" ADD CONSTRAINT "invoice_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_run_id_fkey" FOREIGN KEY ("invoice_run_id") REFERENCES "invoice_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
