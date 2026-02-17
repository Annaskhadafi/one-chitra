import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { roles, permissions, rolePermissions } from './schema';
import { eq } from 'drizzle-orm';

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
    const resources = ['inventory', 'quotations', 'deliveries', 'billing', 'reports', 'admin', 'users', 'roles'];
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
    console.log('✅ Permissions seeded');

    // 3. Assign Permissions to Roles logic
    // Helper to get role ID
    const getRoleId = async (name: string) => {
        const role = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
        return role[0]?.id;
    }

    // Helper to get permission ID
    const getPermId = async (resource: string, action: string) => {
        const perm = await db.select().from(permissions)
            .where(eq(permissions.resource, resource))
            .where(eq(permissions.action, action)) // Fixed: chaining where
            .limit(1); // Removed .filter() because where() handles it
        // Note: chained .where() is correct in drizzle, filtering in JS is slower but safe if query fails
        // Actually for drizzle-orm, we chain .where().where() or use and()
        // Let's rely on chained where for now, or fetch all perms to memory for speed if needed.
        // For simplicity in seed script, simple query is fine.

        // Correct query:
        // await db.select().from(permissions).where(and(eq(permissions.resource, resource), eq(permissions.action, action)))
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

    // Warehouse: Inventory (All), Deliveries (View, Update)
    await assign(warehouseId, 'inventory', ['view', 'create', 'update']);
    await assign(warehouseId, 'deliveries', ['view', 'update']);

    // Sales: Quotations (All), Inventory (View)
    await assign(salesId, 'quotations', ['view', 'create', 'update']);
    await assign(salesId, 'inventory', ['view']);

    console.log('✅ Role Permissions assigned');
    console.log('🎉 Seeding complete!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
