import { getHistoryOrder } from "../app/actions/history-order";

async function main() {
    console.log("Testing getHistoryOrder...");
    try {
        const res = await getHistoryOrder({
            page: 1,
            pageSize: 10
        });
        console.log("Result:", JSON.stringify(res, null, 2));
    } catch (err) {
        console.error("FATAL ERROR:", err);
    }
    process.exit(0);
}
main();
