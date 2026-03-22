import { getProductHistoryForQuotation } from "../app/actions/history-order";

async function main() {
    console.log("Testing getProductHistoryForQuotation with FIXED schema...");
    const res = await getProductHistoryForQuotation("1101240204", 0);
    console.log("Result:", JSON.stringify(res, null, 2));
    process.exit(0);
}
main();
