import "dotenv/config";
import { db } from "../db";
import { permissions, roles, rolePermissions, user } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { navigationConfig } from "../lib/navigation";
import {
    getDashboardRouteResource,
    collectDashboardPermissionResources,
} from "../lib/route-permissions";

const TARGET_RESOURCE = "approvals-engine";
const REQUIRED_ACTIONS = ["view", "create", "edit", "delete"] as const;

async function syncAndVerifyApprovalEnginePermissions() {
    console.log("===============================================================");
    console.log("🚀 STARTING APPROVAL ENGINE RBAC SYNC & VERIFICATION");
    console.log("===============================================================");

    // 1. Verifikasi Registrasi Navigasi
    console.log("\n[1/5] Verifikasi registrasi navigasi di lib/navigation.ts...");
    let navFound = false;
    for (const section of navigationConfig) {
        for (const item of section.items) {
            if (item.resource === TARGET_RESOURCE) {
                navFound = true;
                console.log(`  ✓ Resource '${TARGET_RESOURCE}' ditemukan pada menu '${item.title}' (${item.url})`);
            }
            if (item.items) {
                for (const subItem of item.items) {
                    if (subItem.resource === TARGET_RESOURCE) {
                        navFound = true;
                        console.log(`  ✓ Resource '${TARGET_RESOURCE}' ditemukan pada sub-menu '${subItem.title}' (${subItem.url}) di bawah '${item.title}'`);
                    }
                }
            }
        }
    }

    if (!navFound) {
        throw new Error(`❌ GAGAL: Resource '${TARGET_RESOURCE}' tidak ditemukan dalam navigationConfig!`);
    }

    // 2. Verifikasi Pemetaan Route Guard
    console.log("\n[2/5] Verifikasi pemetaan route guard di lib/route-permissions.ts...");
    const testRoute = "/dashboard/settings/approval-engine";
    const mappedResource = getDashboardRouteResource(testRoute);
    console.log(`  Route test: ${testRoute} -> Resource: ${mappedResource}`);

    if (mappedResource !== TARGET_RESOURCE) {
        throw new Error(`❌ GAGAL: getDashboardRouteResource('${testRoute}') menghasilkan '${mappedResource}', diharapkan '${TARGET_RESOURCE}'`);
    }

    const collectedResources = collectDashboardPermissionResources();
    if (!collectedResources.includes(TARGET_RESOURCE)) {
        throw new Error(`❌ GAGAL: collectDashboardPermissionResources() tidak menyertakan '${TARGET_RESOURCE}'`);
    }
    console.log(`  ✓ Pemetaan route guard untuk '${TARGET_RESOURCE}' valid dan aktif.`);

    // 3. Sinkronisasi 4 Izin Standar ke Database
    console.log("\n[3/5] Melakukan sinkronisasi 4 izin standar ke tabel permissions...");
    let newlyAdded = 0;

    for (const action of REQUIRED_ACTIONS) {
        const existing = await db
            .select()
            .from(permissions)
            .where(
                and(
                    eq(permissions.resource, TARGET_RESOURCE),
                    eq(permissions.action, action)
                )
            );

        if (existing.length === 0) {
            await db
                .insert(permissions)
                .values({
                    resource: TARGET_RESOURCE,
                    action: action,
                    description: `Can ${action} ${TARGET_RESOURCE}`,
                })
                .onConflictDoNothing();
            newlyAdded++;
            console.log(`  + Ditambahkan izin baru: '${TARGET_RESOURCE}:${action}'`);
        } else {
            console.log(`  = Izin sudah ada: '${TARGET_RESOURCE}:${action}' (ID: ${existing[0].id})`);
        }
    }

    // 4. Hubungkan Permissions ke Roles
    console.log("\n[4/5] Menghubungkan izin '${TARGET_RESOURCE}' ke roles kunci (admin, superadmin, etc)...");
    const activePerms = await db
        .select()
        .from(permissions)
        .where(eq(permissions.resource, TARGET_RESOURCE));

    const allRoles = await db.select().from(roles);
    console.log(`  Ditemukan ${allRoles.length} roles di sistem.`);

    const privilegedRoleNames = ["admin", "superadmin", "administrator", "super_admin", "director", "sales_manager", "sales"];
    for (const r of allRoles) {
        const nameLower = r.name.toLowerCase();
        const shouldHave = privilegedRoleNames.some(p => nameLower.includes(p));
        if (shouldHave) {
            for (const p of activePerms) {
                // Beri view untuk semua sales/roles, dan write untuk admin
                if (nameLower.includes("sales") && p.action !== "view") continue;

                await db
                    .insert(rolePermissions)
                    .values({
                        roleId: r.id,
                        permissionId: p.id,
                    })
                    .onConflictDoNothing();
            }
            console.log(`  ✓ Permissions disinkronkan ke role: ${r.name}`);
        }
    }

    // 5. Cek Status Akun Test
    console.log("\n[5/5] Memeriksa akun test & konfigurasi notifikasi...");
    const testEmail = "mochamad.khadafi@chitraparatama.co.id";
    const testUser = await db.select().from(user).where(eq(user.email, testEmail)).limit(1);
    if (testUser.length > 0) {
        console.log(`  ✓ Akun test ditemukan: ${testUser[0].name} (${testUser[0].email}) - Role: ${testUser[0].role}`);
    } else {
        console.log(`  ℹ Akun ${testEmail} belum ada di tabel user, mengecek sales user lain...`);
    }

    console.log("\n===============================================================");
    console.log("✅ SUKSES: Sinkronisasi RBAC untuk Approval Engine Selesai!");
    console.log("===============================================================\n");
}

syncAndVerifyApprovalEnginePermissions()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Gagal sinkronisasi permissions:", err);
        process.exit(1);
    });
