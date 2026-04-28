import 'dotenv/config';
import { getSalesOrders } from './app/actions/sales-order.js';

async function main() {
    try {
        await getSalesOrders();
        console.log("Success");
    } catch(e: any) {
        console.error("Error:");
        console.error(e.cause || e);
    }
    process.exit(0);
}
main();
