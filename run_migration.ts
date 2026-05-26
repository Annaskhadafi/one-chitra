import 'dotenv/config';
import { db } from './db/index';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function main() {
    try {
        const sqlContent = fs.readFileSync(path.join(__dirname, 'drizzle/0038_overjoyed_salo.sql'), 'utf-8');
        const statements = sqlContent.split('--> statement-breakpoint');
        
        for (let statement of statements) {
            statement = statement.trim();
            if (statement) {
                try {
                    await db.execute(sql.raw(statement));
                } catch (err: any) {
                    const errMsg = String(err) + String(err.cause);
                    if (errMsg.includes('already exists')) {
                        console.log('Skipping existing constraint/column/table:', err.message);
                    } else {
                        throw err;
                    }
                }
            }
        }
        console.log("Migration 0038 applied successfully");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}
main();
