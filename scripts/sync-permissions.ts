import { syncPermissions } from "../app/actions/permissions";

async function main() {
    console.log("Syncing permissions...");
    try {
        const res = await syncPermissions();
        if (res.success) {
            console.log(`Successfully synced permissions. Added ${res.added} new permissions.`);
        } else {
            console.error("Failed to sync permissions:", res.error);
        }
    } catch (error) {
        console.error("An error occurred during sync:", error);
    }
    process.exit(0);
}

main();
