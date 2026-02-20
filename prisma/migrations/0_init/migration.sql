-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "state_name" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_ifsc" TEXT,
    "bank_branch" TEXT,
    "bank_upi_id" TEXT,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'INV/',
    "invoice_next_number" INTEGER NOT NULL DEFAULT 1,
    "quote_prefix" TEXT NOT NULL DEFAULT 'QT/',
    "quote_next_number" INTEGER NOT NULL DEFAULT 1,
    "credit_note_prefix" TEXT NOT NULL DEFAULT 'CN/',
    "credit_note_next_number" INTEGER NOT NULL DEFAULT 1,
    "default_terms" TEXT,
    "default_payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "financial_year_start" TEXT NOT NULL DEFAULT '04',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "billing_address_line1" TEXT,
    "billing_address_line2" TEXT,
    "billing_city" TEXT,
    "billing_state" TEXT,
    "billing_state_name" TEXT,
    "billing_pincode" TEXT,
    "shipping_address_line1" TEXT,
    "shipping_address_line2" TEXT,
    "shipping_city" TEXT,
    "shipping_state" TEXT,
    "shipping_state_name" TEXT,
    "shipping_pincode" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_whatsapp" TEXT,
    "payment_terms_days" INTEGER,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "state_name" TEXT,
    "pincode" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "payment_terms_days" INTEGER,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hsn_sac_code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'service',
    "unit" TEXT NOT NULL DEFAULT 'nos',
    "default_rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "cost_center" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_date" DATE,
    "end_date" DATE,
    "budget" DECIMAL(15,2),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "quote_number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_quote_id" UUID,
    "customer_id" UUID NOT NULL,
    "project_id" UUID,
    "cost_center" TEXT,
    "quote_date" DATE NOT NULL,
    "expiry_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_value" DECIMAL(15,2),
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "converted_invoice_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "item_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "hsn_sac_code" TEXT,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'nos',
    "rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_value" DECIMAL(15,2),
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "project_id" UUID,
    "cost_center" TEXT,
    "quote_id" UUID,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "place_of_supply" TEXT,
    "is_reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_value" DECIMAL(15,2),
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tds_applicable" BOOLEAN NOT NULL DEFAULT false,
    "tds_rate" DECIMAL(5,2),
    "tds_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tds_certificate_status" TEXT NOT NULL DEFAULT 'not_applicable',
    "tds_certificate_received_date" DATE,
    "retention_applicable" BOOLEAN NOT NULL DEFAULT false,
    "retention_rate" DECIMAL(5,2),
    "retention_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retention_release_date" DATE,
    "retention_status" TEXT NOT NULL DEFAULT 'not_applicable',
    "notes" TEXT,
    "terms" TEXT,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_ifsc" TEXT,
    "bank_branch" TEXT,
    "bank_upi_id" TEXT,
    "next_follow_up_date" DATE,
    "follow_up_notes" TEXT,
    "vendor_gst_filed" BOOLEAN NOT NULL DEFAULT false,
    "gstr2b_reflected" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "item_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "hsn_sac_code" TEXT,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'nos',
    "rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_value" DECIMAL(15,2),
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'received',
    "invoice_id" UUID,
    "customer_id" UUID,
    "vendor_id" UUID,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_mode" TEXT NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "vendor_bill_id" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'sales',
    "invoice_id" UUID,
    "customer_id" UUID,
    "project_id" UUID,
    "cn_date" DATE NOT NULL,
    "reason" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "item_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "hsn_sac_code" TEXT,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'nos',
    "rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "txn_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "narration" TEXT,
    "reference_number" TEXT,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(15,2),
    "bank_account_label" TEXT,
    "import_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    "matched_payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bills" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "bill_number" TEXT NOT NULL,
    "bill_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "place_of_supply" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tds_applicable" BOOLEAN NOT NULL DEFAULT false,
    "tds_rate" DECIMAL(5,2),
    "tds_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_filed" BOOLEAN NOT NULL DEFAULT false,
    "gstr2b_reflected" BOOLEAN NOT NULL DEFAULT false,
    "portal_check_date" DATE,
    "itc_eligible" BOOLEAN NOT NULL DEFAULT true,
    "compliance_notes" TEXT,
    "notes" TEXT,
    "attachment_url" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_bill_lines" (
    "id" UUID NOT NULL,
    "vendor_bill_id" UUID NOT NULL,
    "item_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "hsn_sac_code" TEXT,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'nos',
    "rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "company_users_company_id_user_id_key" ON "company_users"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "customers_company_id_name_idx" ON "customers"("company_id", "name");

-- CreateIndex
CREATE INDEX "customers_company_id_gstin_idx" ON "customers"("company_id", "gstin");

-- CreateIndex
CREATE INDEX "vendors_company_id_name_idx" ON "vendors"("company_id", "name");

-- CreateIndex
CREATE INDEX "items_company_id_name_idx" ON "items"("company_id", "name");

-- CreateIndex
CREATE INDEX "projects_company_id_name_idx" ON "projects"("company_id", "name");

-- CreateIndex
CREATE INDEX "quotes_company_id_status_idx" ON "quotes"("company_id", "status");

-- CreateIndex
CREATE INDEX "quotes_company_id_customer_id_idx" ON "quotes"("company_id", "customer_id");

-- CreateIndex
CREATE INDEX "invoices_company_id_status_idx" ON "invoices"("company_id", "status");

-- CreateIndex
CREATE INDEX "invoices_company_id_customer_id_idx" ON "invoices"("company_id", "customer_id");

-- CreateIndex
CREATE INDEX "invoices_company_id_due_date_idx" ON "invoices"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "invoices_company_id_invoice_number_idx" ON "invoices"("company_id", "invoice_number");

-- CreateIndex
CREATE INDEX "payments_company_id_type_idx" ON "payments"("company_id", "type");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_vendor_bill_id_idx" ON "payments"("vendor_bill_id");

-- CreateIndex
CREATE INDEX "credit_notes_company_id_status_idx" ON "credit_notes"("company_id", "status");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_status_idx" ON "bank_transactions"("company_id", "status");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_txn_date_idx" ON "bank_transactions"("company_id", "txn_date");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_company_id_import_hash_key" ON "bank_transactions"("company_id", "import_hash");

-- CreateIndex
CREATE INDEX "vendor_bills_company_id_status_idx" ON "vendor_bills"("company_id", "status");

-- CreateIndex
CREATE INDEX "vendor_bills_company_id_vendor_id_idx" ON "vendor_bills"("company_id", "vendor_id");

-- CreateIndex
CREATE INDEX "vendor_bills_company_id_due_date_idx" ON "vendor_bills"("company_id", "due_date");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "attachments_company_id_idx" ON "attachments"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_entity_type_entity_id_idx" ON "audit_logs"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_company_id_key_key" ON "settings"("company_id", "key");

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_quote_id_fkey" FOREIGN KEY ("parent_quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_bill_id_fkey" FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_payment_id_fkey" FOREIGN KEY ("matched_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_vendor_bill_id_fkey" FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

