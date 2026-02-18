
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database successfully!');

        // Check if settings table exists, create if not
        console.log('Creating settings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
        `);

        // Increase category length
        console.log('Increasing category column length...');
        await client.query(`ALTER TABLE products ALTER COLUMN category TYPE VARCHAR(100);`);

        // Check columns in products table
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products'
        `);
        const columns = res.rows.map(r => r.column_name);

        if (!columns.includes('cost_sap')) {
            console.log('Adding cost_sap column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN cost_sap TEXT;`);
        }

        if (!columns.includes('image_url')) {
            console.log('Adding image_url column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
        }

        if (!columns.includes('plant')) {
            console.log('Adding plant column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN plant VARCHAR(100);`);
        }

        if (!columns.includes('sloc')) {
            console.log('Adding sloc column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN sloc VARCHAR(100);`);
        }

        if (!columns.includes('sloc_description')) {
            console.log('Adding sloc_description column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN sloc_description TEXT;`);
        }

        // Handle unique constraint change
        console.log('Checking unique constraints...');
        const constraintsRes = await client.query(`
            SELECT conname
            FROM pg_constraint
            JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
            WHERE pg_class.relname = 'products' AND contype = 'u';
        `);
        const constraints = constraintsRes.rows.map(r => r.conname);

        // Find constraint on material_number only
        // Usually named like products_material_number_unique
        const oldConstraint = constraints.find(c => c.includes('material_number') && !c.includes('sloc'));
        if (oldConstraint) {
            console.log(`Dropping old unique constraint: ${oldConstraint}`);
            await client.query(`ALTER TABLE products DROP CONSTRAINT "${oldConstraint}";`);
        }

        // Add new composite constraint if it doesn't exist
        const compositeConstraint = constraints.find(c => c.includes('material_number') && c.includes('sloc'));
        if (!compositeConstraint) {
            console.log('Adding composite unique constraint (material_number, sloc)...');
            await client.query(`ALTER TABLE products ADD CONSTRAINT products_material_number_sloc_unique UNIQUE (material_number, sloc);`);
        }

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}

main();
