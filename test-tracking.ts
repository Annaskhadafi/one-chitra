import { getEvhsTrackingData } from './app/actions/evhs';

async function main() {
    try {
        const data = await getEvhsTrackingData();
        console.log("Tracking Data length:", data.length);
        if (data.length > 0) {
            console.log("Sample:", data[0]);
        } else {
            // Check receipts
            const { db } = await import('./db');
            const receipts = await db.query.evhsReceipts.findMany({
                with: { items: true }
            });
            console.log("Receipts length:", receipts.length);
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
main();
