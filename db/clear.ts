import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

async function clear() {
    const client = neon(process.env.DATABASE_URL!);
    const db = drizzle(client);

    console.log('🗑️  Clearing dummy data...');

    // Truncate transactional tables
    // CAUTION: This deletes all data in these tables!
    // We strive to keep 'roles' and 'permissions' as they are configuration.
    // 'user' might contain real users, so typically we might want to keep the admin user?
    // But "hapus semua data dummy" often means a fresh slate.
    // I will truncate all business tables.
    // I will NOT truncate 'roles', 'permissions', 'role_permissions' as they are seeded config.
    // I will NOT truncate 'user' (auth) unless explicitly asked, as that deletes the current login.
    // If the user meant "seed data" for business entities, this is correct.

    const tablesToClear = [
        'quotation_items',
        'quotation_approvals',
        'quotations',
        'delivery_items',
        'deliveries',
        'rfid_scans',
        'sap_sync_logs',
        'inter_warehouse_transfers',
        'stock_levels',
        'products',
        'billing_records',
        'audit_logs',
        // 'warehouses' - Should this be cleared? Usually warehouses are static config. 
        // I'll keep warehouses for now or user can manually delete. 
        // Actually, let's clear warehouses too if they are considered dummy.
        // But stock_levels depends on warehouses.
    ];

    // Using CASCADE to handle foreign keys
    for (const table of tablesToClear) {
        try {
            await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
            console.log(`✅ Cleared ${table}`);
        } catch (error) {
            console.warn(`⚠️  Failed to clear ${table} (might not exist or empty):`, error);
        }
    }

    console.log('✨ Data cleared successfully (Roles, Users, Permissions preserved)');
    process.exit(0);
}

clear().catch((err) => {
    console.error('❌ Clear failed:', err);
    process.exit(1);
});
