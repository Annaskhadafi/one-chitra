import { fetchGoodReceiveFromSAP } from "../app/actions/good-receive"

async function main() {
    console.log("Testing fetchGoodReceiveFromSAP...")
    console.log("----------------------------------")

    const testStartDate = "2026-03-01";
    const testEndDate = "2026-03-31";

    console.log(`Input Dates: Start=${testStartDate}, End=${testEndDate}`)
    const res = await fetchGoodReceiveFromSAP(testStartDate, testEndDate);

    if (res.success && res.data) {
        console.log(`✅ Success! Fetched ${res.data.length} records.`);
        if (res.data.length > 0) {
            console.log("\nSample Data (First 3):");
            console.log(JSON.stringify(res.data.slice(0, 3), null, 2));

            // Test constraints
            const hasEmptyMaterial = res.data.some(d => !d.materialnumb || d.materialnumb === "" || d.materialnumb === "-");
            console.log(`\nValidation - Contains Empty Material No: ${hasEmptyMaterial}`);
        }
    } else {
        console.log("❌ Failed:", res.error);
    }

    process.exit(0);
}

main().catch(console.error);
