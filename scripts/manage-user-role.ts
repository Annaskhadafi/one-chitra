import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { user, session, roles, permissions, rolePermissions } from '../db/schema';
import { desc, eq, ilike, or } from 'drizzle-orm';

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });
    const db = drizzle(pool);

    const action = process.argv[2];
    const param1 = process.argv[3];
    const param2 = process.argv[4];

    if (action === "list-roles") {
        console.log("=== DAFTAR ROLES DI DATABASE ===");
        const allRoles = await db.select().from(roles);
        for (const r of allRoles) {
            console.log(`- [ID: ${r.id}] ${r.name} (${r.description || '-'})`);
        }
    } else if (action === "ensure-roles") {
        console.log("=== MEMASTIKAN ROLE PROCUREMENT ADA DI ROLES TABLE ===");
        await db.insert(roles).values([
            { name: "Admin Procurement", description: "Admin Procurement untuk entry & pengelolaan invoice vendor" },
            { name: "Procurement Admin", description: "Procurement Administrator" },
        ]).onConflictDoNothing();
        console.log("✅ Roles Admin Procurement & Procurement Admin sudah dipastikan ada!");
    } else if (action === "search" && param1) {
        console.log(`\n=== PENCARIAN PENGGUNA: "${param1}" ===`);
        const results = await db.select().from(user).where(
            or(ilike(user.name, `%${param1}%`), ilike(user.email, `%${param1}%`))
        );
        for (const u of results) {
            console.log(`- [${u.id}] ${u.name} <${u.email}> | Current Role: "${u.role}" | Dept: ${u.department}`);
        }
    } else if (action === "set-role" && param1 && param2) {
        console.log(`\n=== MENGUBAH ROLE PENGGUNA ===`);
        console.log(`Target: ${param1} -> Role Baru: "${param2}"`);
        const updated = await db.update(user)
            .set({ role: param2, updatedAt: new Date() })
            .where(or(ilike(user.email, param1), eq(user.id, param1)))
            .returning();
        
        if (updated.length > 0) {
            console.log(`✅ BERHASIL! Pengguna ${updated[0].name} (${updated[0].email}) sekarang memiliki role: "${updated[0].role}"`);
        } else {
            console.log(`❌ Pengguna dengan email/ID "${param1}" tidak ditemukan.`);
        }
    } else if (action === "make-admin" && param1) {
        console.log(`\n=== MENJADIKAN USER SEBAGAI ADMIN ===`);
        const updated = await db.update(user)
            .set({ role: "Admin", updatedAt: new Date() })
            .where(or(ilike(user.email, param1), eq(user.id, param1)))
            .returning();

        if (updated.length > 0) {
            console.log(`✅ BERHASIL! ${updated[0].name} (${updated[0].email}) sekarang memiliki role "Admin" (Full Access).`);
        } else {
            console.log(`❌ Pengguna dengan email/ID "${param1}" tidak ditemukan.`);
        }
    } else {
        console.log("=== STATUS SESI TERAKHIR ===");
        const activeSessions = await db.select({
            sessionId: session.id,
            userId: session.userId,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
        })
        .from(session)
        .innerJoin(user, eq(session.userId, user.id))
        .orderBy(desc(session.createdAt))
        .limit(5);

        for (const s of activeSessions) {
            console.log(`- ${s.userName} <${s.userEmail}> | Role: ${s.userRole} | Waktu Login: ${s.createdAt}`);
        }

        console.log("\n=== CARA PENGGUNAAN ===");
        console.log("1. Melihat daftar roles yang ada:");
        console.log("   npx tsx scripts/manage-user-role.ts list-roles\n");
        console.log("2. Mencari user berdasarkan nama atau email:");
        console.log("   npx tsx scripts/manage-user-role.ts search <nama-atau-email>\n");
        console.log("3. Mengubah role user (misal: Admin, Procurement Admin, dll):");
        console.log("   npx tsx scripts/manage-user-role.ts set-role <email> <nama-role>\n");
        console.log("4. Langsung menjadikan Admin (Full Access):");
        console.log("   npx tsx scripts/manage-user-role.ts make-admin <email>\n");
    }

    await pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
});
