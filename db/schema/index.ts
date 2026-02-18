// Auth tables (better-auth)
export { user, session, account, verification } from "./auth";
import { relations } from "drizzle-orm";
import { warehouses } from "./warehouses";
import { stockLevels } from "./stock-levels";

export const warehousesRelations = relations(warehouses, ({ many }) => ({
    stocks: many(stockLevels),
}));
export { settings } from "./settings";

// Business domain tables
export { roles } from "./roles";
export { permissions } from "./permissions";
export { rolePermissions } from "./role-permissions";
export { warehouses } from "./warehouses";
export { products } from "./products";
export { stockLevels, stockLevelsRelations } from "./stock-levels";
export {
    stockTransfers,
    stockTransferItems,
    stockTransfersRelations,
    stockTransferItemsRelations,
} from "./transfers";
export { sapSyncLogs } from "./sap-sync";
export { rfidScans } from "./rfid-scans";
export { quotations, quotationItems, quotationsRelations, quotationItemsRelations } from "./quotations";
export { deliveries, deliveryItems, deliveriesRelations, deliveryItemsRelations } from "./deliveries";
export { billingRecords } from "./billing";
export { auditLogs } from "./audit-logs";
export { customers } from "./customers";
export { salesOrders, salesOrderItems, salesOrdersRelations, salesOrderItemsRelations } from "./sales-orders";
