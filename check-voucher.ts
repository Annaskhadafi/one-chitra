import { db } from './db';
import { evhsVouchers } from './db/schema/evhs';

async function main() {
    try {
        const v = await db.query.evhsVouchers.findMany({
            with: { items: true }
        });
        console.dir(v, { depth: null });
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
main();
