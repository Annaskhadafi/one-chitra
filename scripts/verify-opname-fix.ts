import 'dotenv/config';
import { getStockOpnameSessions } from '../app/actions/stock-opname';

async function verifyFix() {
    try {
        console.log("Fetching stock opname sessions...");
        const result = await getStockOpnameSessions();
        console.log("Successfully fetched sessions count:", result.length);
        console.log("Verification PASSED: getStockOpnameSessions is working correctly.");
        process.exit(0);
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Verification FAILED: getStockOpnameSessions still throwing error.");
        console.error(error.message);
        process.exit(1);
    }
}

verifyFix();
