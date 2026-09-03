import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { roles, permissions, rolePermissions } from './schema';
import { eq, and } from 'drizzle-orm';

async function seed() {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    console.log('🌱 Seeding database...');

    // 1. Seed Roles
    const defaultRoles = [
        { name: 'Admin', description: 'Full access to all resources' },
        { name: 'Manager', description: 'Can approve quotes and view reports' },
        { name: 'Warehouse', description: 'Inventory management and RFID scanning' },
        { name: 'Sales', description: 'Create quotations and view customers' },
        { name: 'Billing', description: 'Manage invoices and exports' },
        { name: 'Karyawan Umum', description: 'General employee role' },
        { name: 'Central Service Admin', description: 'Central service administration' },
        { name: 'HRGA', description: 'Human Resources and General Affairs' },
    ];

    for (const role of defaultRoles) {
        await db.insert(roles)
            .values(role)
            .onConflictDoUpdate({
                target: roles.name,
                set: { description: role.description }
            });
    }
    console.log('✅ Roles seeded');

    // 2. Seed Permissions
    const resources = [
        'inventory', 'quotations', 'deliveries', 'billing', 'reports', 'admin', 'users', 'roles',
        'stock-alerts', 'stock-opname', 'abc-analysis', 'price-management', 'rfid', 'no-stock-monitoring',
        // Security management resources
        'security',
    ];
    const actions = ['view', 'create', 'update', 'delete'];

    const allPermissions = [];
    for (const resource of resources) {
        for (const action of actions) {
            allPermissions.push({
                resource,
                action,
                description: `Can ${action} ${resource}`,
            });
        }
    }

    // Insert permissions (on conflict do nothing to avoid duplicates)
    for (const perm of allPermissions) {
        await db.insert(permissions)
            .values(perm)
            .onConflictDoNothing();
    }
    await db.insert(permissions)
        .values({ resource: 'no-stock-monitoring', action: 'edit', description: 'Can edit no-stock-monitoring' })
        .onConflictDoNothing();
    console.log('✅ Permissions seeded');

    // 3. Assign Permissions to Roles logic
    // Helper to get role ID
    const getRoleId = async (name: string) => {
        const role = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
        return role[0]?.id;
    }

    // Helper to get permission ID (kept for reference)
    const _getPermId = async (resource: string, action: string) => {
        const perm = await db.select().from(permissions)
            .where(and(eq(permissions.resource, resource), eq(permissions.action, action)))
            .limit(1);
        return perm[0]?.id;
    }

    const adminId = await getRoleId('Admin');
    const warehouseId = await getRoleId('Warehouse');
    const salesId = await getRoleId('Sales');

    // Fetch all permission records to map easily
    const dbPerms = await db.select().from(permissions);

    const assign = async (roleId: number, resource: string, actions: string[]) => {
        if (!roleId) return;
        for (const action of actions) {
            const perm = dbPerms.find(p => p.resource === resource && p.action === action);
            if (perm) {
                await db.insert(rolePermissions)
                    .values({ roleId, permissionId: perm.id })
                    .onConflictDoNothing();
            }
        }
    };

    // Admin: All Access
    if (adminId) {
        for (const p of dbPerms) {
            await db.insert(rolePermissions)
                .values({ roleId: adminId, permissionId: p.id })
                .onConflictDoNothing();
        }
    }

    // Warehouse: Inventory (All), Deliveries (View, Update), Stock Opname, Stock Alerts
    await assign(warehouseId, 'inventory', ['view', 'create', 'update']);
    await assign(warehouseId, 'rfid', ['view', 'create', 'update']);
    await assign(warehouseId, 'deliveries', ['view', 'update']);
    await assign(warehouseId, 'stock-opname', ['view', 'create', 'update']);
    await assign(warehouseId, 'stock-alerts', ['view']);

    // Sales: Quotations (All), Inventory (View), Price Management
    await assign(salesId, 'quotations', ['view', 'create', 'update']);
    await assign(salesId, 'inventory', ['view']);
    await assign(salesId, 'price-management', ['view', 'create', 'update', 'delete']);

    // No Stock Monitoring is available to every seeded role.
    for (const role of await db.select({ id: roles.id }).from(roles)) {
        await assign(role.id, 'no-stock-monitoring', ['view', 'edit']);
    }

    console.log('✅ Role Permissions assigned');
    console.log('🎉 Seeding complete!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
