import "dotenv/config"
import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Applying vendor invoice schema to PostgreSQL...")

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE vendor_tenant_status AS ENUM ('pending_invitation', 'active', 'suspended');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE vendor_invoice_status AS ENUM (
                'draft',
                'submitted',
                'verified_admin',
                'rejected_admin',
                'validated_finance',
                'rejected_finance',
                'approved_manager',
                'rejected_manager',
                'paid'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vendor_tenants (
            id VARCHAR(36) PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            address TEXT,
            npwp TEXT,
            is_pkp BOOLEAN NOT NULL DEFAULT false,
            bank_name TEXT,
            bank_account_no TEXT,
            bank_account_holder TEXT,
            default_top_days INTEGER NOT NULL DEFAULT 30,
            status vendor_tenant_status NOT NULL DEFAULT 'pending_invitation',
            invitation_token VARCHAR(100) UNIQUE,
            invitation_expires_at TIMESTAMP,
            invited_at TIMESTAMP,
            invited_by TEXT REFERENCES "user"(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS vendor_tenants_code_idx ON vendor_tenants(code);
        CREATE INDEX IF NOT EXISTS vendor_tenants_email_idx ON vendor_tenants(email);
        CREATE INDEX IF NOT EXISTS vendor_tenants_status_idx ON vendor_tenants(status);
        CREATE INDEX IF NOT EXISTS vendor_tenants_invitation_token_idx ON vendor_tenants(invitation_token);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vendor_tenant_users (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(36) NOT NULL REFERENCES vendor_tenants(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            role VARCHAR(30) NOT NULL DEFAULT 'owner',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT vendor_tenant_users_unique UNIQUE (tenant_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS vendor_tenant_users_tenant_idx ON vendor_tenant_users(tenant_id);
        CREATE INDEX IF NOT EXISTS vendor_tenant_users_user_idx ON vendor_tenant_users(user_id);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vendor_payment_batches (
            id VARCHAR(36) PRIMARY KEY,
            batch_code VARCHAR(60) NOT NULL UNIQUE,
            payment_date TIMESTAMP NOT NULL,
            total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
            total_invoices INTEGER NOT NULL DEFAULT 0,
            bank_source TEXT NOT NULL,
            proof_file_url TEXT NOT NULL,
            reference_no TEXT,
            notes TEXT,
            disbursed_by TEXT REFERENCES "user"(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS vendor_payment_batches_code_idx ON vendor_payment_batches(batch_code);
        CREATE INDEX IF NOT EXISTS vendor_payment_batches_date_idx ON vendor_payment_batches(payment_date);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vendor_invoices (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(36) NOT NULL REFERENCES vendor_tenants(id) ON DELETE CASCADE,
            invoice_number VARCHAR(150) NOT NULL,
            po_number VARCHAR(100) NOT NULL,
            invoice_date TIMESTAMP NOT NULL,
            subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
            ppn_percent NUMERIC(5, 2) NOT NULL DEFAULT 11,
            ppn_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
            pph_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
            pph_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
            grand_total NUMERIC(18, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
            top_days INTEGER NOT NULL DEFAULT 30,
            status vendor_invoice_status NOT NULL DEFAULT 'submitted',
            rejection_reason TEXT,
            rejection_stage VARCHAR(30),
            rejection_notes TEXT,
            invoice_file_url TEXT NOT NULL,
            tax_invoice_file_url TEXT,
            po_file_url TEXT,
            delivery_receipt_file_url TEXT,
            additional_file_url TEXT,
            checklist_doc_valid BOOLEAN NOT NULL DEFAULT false,
            checklist_po_valid BOOLEAN NOT NULL DEFAULT false,
            checklist_calc_valid BOOLEAN NOT NULL DEFAULT false,
            checklist_bank_valid BOOLEAN NOT NULL DEFAULT false,
            checklist_tax_valid BOOLEAN NOT NULL DEFAULT false,
            admin_checklist_notes TEXT,
            admin_verified_at TIMESTAMP,
            admin_verified_by TEXT REFERENCES "user"(id),
            finance_validated_at TIMESTAMP,
            finance_validated_by TEXT REFERENCES "user"(id),
            finance_notes TEXT,
            book_received_date TIMESTAMP,
            payment_due_date TIMESTAMP,
            scheduled_payment_date TIMESTAMP,
            manager_approved_at TIMESTAMP,
            manager_approved_by TEXT REFERENCES "user"(id),
            manager_notes TEXT,
            payment_batch_id VARCHAR(36) REFERENCES vendor_payment_batches(id) ON DELETE SET NULL,
            paid_at TIMESTAMP,
            paid_proof_url TEXT,
            paid_reference_no TEXT,
            paid_email_sent_at TIMESTAMP,
            created_by TEXT REFERENCES "user"(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT vendor_invoices_tenant_number_unique UNIQUE (tenant_id, invoice_number)
        );
        CREATE INDEX IF NOT EXISTS vendor_invoices_tenant_idx ON vendor_invoices(tenant_id);
        CREATE INDEX IF NOT EXISTS vendor_invoices_po_idx ON vendor_invoices(po_number);
        CREATE INDEX IF NOT EXISTS vendor_invoices_status_idx ON vendor_invoices(status);
        CREATE INDEX IF NOT EXISTS vendor_invoices_scheduled_payment_idx ON vendor_invoices(scheduled_payment_date);
        CREATE INDEX IF NOT EXISTS vendor_invoices_due_date_idx ON vendor_invoices(payment_due_date);
        CREATE INDEX IF NOT EXISTS vendor_invoices_batch_idx ON vendor_invoices(payment_batch_id);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS vendor_invoice_logs (
            id SERIAL PRIMARY KEY,
            invoice_id VARCHAR(36) NOT NULL REFERENCES vendor_invoices(id) ON DELETE CASCADE,
            action VARCHAR(50) NOT NULL,
            actor_id TEXT REFERENCES "user"(id),
            actor_name TEXT,
            actor_role TEXT,
            notes TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS vendor_invoice_logs_invoice_idx ON vendor_invoice_logs(invoice_id);
        CREATE INDEX IF NOT EXISTS vendor_invoice_logs_action_idx ON vendor_invoice_logs(action);
        CREATE INDEX IF NOT EXISTS vendor_invoice_logs_created_at_idx ON vendor_invoice_logs(created_at);
    `)

    console.log("Vendor invoice schema applied successfully!")
    process.exit(0)
}

main().catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
})
