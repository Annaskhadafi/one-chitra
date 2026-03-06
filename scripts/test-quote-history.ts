import { getProductHistoryForQuotation } from "../app/actions/history-order";

async function main() {
    console.log("Testing getProductHistoryForQuotation...");
    const res = await getProductHistoryForQuotation("1101240204", 0);
    console.log("Result:", res);
    process.exit(0);
}
main();
