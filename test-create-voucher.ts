import { createEvhsVoucher } from './app/actions/evhs';

async function main() {
    try {
        const result = await createEvhsVoucher({
            woNo: "TEST-WO-123",
            date: new Date(),
            warehouseId: 37,
            remark: "Test Script",
            approvedByName: "Auto",
            receivedByName: "Bot",
            items: [{
                productId: 132,
                materialNumberCk: "TEST-CK",
                qty: 1,
                serialNumber: "XGX TEST M9Z",
                pos: "#TEST-POS",
                unitId: "UNIT-999"
            }]
        });
        console.log(result);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
main();
