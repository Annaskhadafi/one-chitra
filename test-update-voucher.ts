import { updateEvhsUsage } from './app/actions/evhs';

async function main() {
    try {
        const result = await updateEvhsUsage({
            voucherId: 2,
            voucherItemId: 2,
            woNo: "490000854",
            materialNumberCk: "900052960",
            pos: "POS-TEST",
            unitId: "UNIT-TEST"
        });
        console.log("Update Result:", result);
    } catch(e) {
        console.error("Test Error:", e);
    }
    process.exit(0);
}
main();
