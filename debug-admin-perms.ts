
import { getPermissionsByRoleName } from "./app/actions/roles";

async function main() {
    console.log("--- Debugging Admin Permissions ---");

    console.log("Fetching permissions for 'Admin'...");
    const permsAdmin = await getPermissionsByRoleName('Admin');
    console.log(`'Admin' permissions count: ${permsAdmin.length}`);
    console.log("Sample:", permsAdmin.slice(0, 5));

    console.log("\nFetching permissions for 'admin' (lowercase)...");
    const permsLower = await getPermissionsByRoleName('admin');
    console.log(`'admin' permissions count: ${permsLower.length}`);

    if (permsAdmin.length === 0) {
        console.error("❌ CRITICAL: 'Admin' role has NO permissions!");
    } else {
        console.log("✅ 'Admin' role has permissions.");
    }
}

main().catch(console.error).then(() => process.exit(0));
