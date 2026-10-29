import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db";

async function main() {
    console.log("Checking and creating customer_legal_documents table...");
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS customer_legal_documents (
            id SERIAL PRIMARY KEY,
            customer_name VARCHAR(255) NOT NULL,
            customer_code VARCHAR(100),
            
            npwp_number VARCHAR(100),
            npwp_file_url TEXT,
            npwp_status BOOLEAN DEFAULT FALSE,
            
            akta_pendirian_number VARCHAR(100),
            akta_pendirian_file_url TEXT,
            akta_pendirian_status BOOLEAN DEFAULT FALSE,
            
            akta_perubahan_number VARCHAR(100),
            akta_perubahan_file_url TEXT,
            akta_perubahan_status BOOLEAN DEFAULT FALSE,
            
            nib_number VARCHAR(100),
            nib_file_url TEXT,
            nib_status BOOLEAN DEFAULT FALSE,
            
            pkp_ptkp_number VARCHAR(100),
            pkp_ptkp_file_url TEXT,
            pkp_ptkp_status BOOLEAN DEFAULT FALSE,
            
            sk_kemenkumham_pendirian_number VARCHAR(100),
            sk_kemenkumham_pendirian_file_url TEXT,
            sk_kemenkumham_pendirian_status BOOLEAN DEFAULT FALSE,
            
            sk_kemenkumham_perubahan_number VARCHAR(100),
            sk_kemenkumham_perubahan_file_url TEXT,
            sk_kemenkumham_perubahan_status BOOLEAN DEFAULT FALSE,
            
            ktp_shareholder_name VARCHAR(255),
            ktp_shareholder_nik VARCHAR(100),
            ktp_shareholder_file_url TEXT,
            ktp_shareholder_status BOOLEAN DEFAULT FALSE,
            
            other_documents JSONB DEFAULT '[]'::jsonb,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    `);
    console.log("customer_legal_documents table created or verified successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Failed to create table:", err);
    process.exit(1);
});
