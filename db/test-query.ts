import { db } from './index';
import { evhsVouchers, evhsVoucherItems, evhsGiRecords } from './schema/evhs';

async function main() {
  try {
    const vouchers = await db.query.evhsVouchers.findMany({
        with: {
            items: {
                with: {
                    product: true
                }
            },
            warehouse: true,
            issuedByUser: true
        },
        orderBy: (evhsVouchers, { desc }) => [desc(evhsVouchers.createdAt)]
    });
    console.log("Success vouchers:", vouchers.length);

    const tracking = await db.query.evhsVouchers.findMany({
        with: {
            items: true
        }
    });
    console.log("Success tracking vouchers length:", tracking.length);

    process.exit(0);
  } catch (err) {
    console.error("QUERY ERROR:", err);
    process.exit(1);
  }
}
main();
