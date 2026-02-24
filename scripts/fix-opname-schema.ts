import 'dotenv/config';
import pg from 'pg';

async function fixSchema() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        // Add missing columns if they don't exist
        const queries = [
            `ALTER TABLE "stock_opname_sessions" ALTER COLUMN "document_url" SET DATA TYPE varchar(500);`,
            `ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "document_title" varchar(200);`,
            `ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "document_file_name" varchar(200);`,
            `ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "document_file_type" varchar(100);`,
            `ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "document_file_size" integer;`,
            `ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "document_uploaded_at" timestamp;`,
            `ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "document_uploaded_by" text;`,
            `ALTER TABLE "stock_opname_sessions" DROP CONSTRAINT IF EXISTS "stock_opname_sessions_document_uploaded_by_user_id_fk";`,
            `ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_document_uploaded_by_user_id_fk" FOREIGN KEY ("document_uploaded_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;`
        ];

        for (const query of queries) {
            try {
                await client.query(query);
                console.log(`Executed: ${query.substring(0, 50)}...`);
            } catch (err: unknown) {
                const error = err as { code?: string; message?: string };
                if (error.code === '42701') {
                    console.log(`Column already exists, skipping...`);
                } else if (error.code === '42710') {
                    console.log(`Constraint already exists, skipping...`);
                } else {
                    console.error(`Error executing query: ${query}`, error.message);
                }
            }
        }

        console.log("Schema fix completed.");
    } catch (err) {
        console.error("Connection error:", err);
    } finally {
        await client.end();
    }
}

fixSchema();
