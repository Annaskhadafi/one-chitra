// Trigger recompile
export { user, session, account, verification } from "./auth";
import { relations } from "drizzle-orm";
import { warehouses } from "./warehouses";
import { stockLevels } from "./stock-levels";

export const warehousesRelations = relations(warehouses, ({ many }) => ({
    stocks: many(stockLevels),
}));
export { settings } from "./settings";

// Domain tables & Relations
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
export { goodReceiveManual, goodReceiveManualItems, goodReceiveManualRelations, goodReceiveManualItemsRelations } from "./good-receive-manual";
export { fleetDrivers, fleetVehicles } from "./fleet";
export { fleetTrips, fleetTripsRelations } from "./fleet-trips";
export { historyOrders } from "./history-orders";
export { salesDocuments } from "./sales-documents";
export { competitorPrices, competitorActivities, lostSales } from "./competitor-new";
export { stockMovements, stockMovementsRelations } from "./stock-movements";
export { portalItems } from "./portal-items";
export { smtpSettings, emailTemplates, emailLogs, emailTemplateTypeEnum, emailRecipientRoleEnum } from "./email";

// Core Auth Table Relations
import { user } from "./auth";
import { salesDocuments } from "./sales-documents";
import { competitorPrices, competitorActivities, lostSales } from "./competitor-new";

export const salesDocumentsRelations = relations(salesDocuments, ({ one }) => ({
    uploadedBy: one(user, {
        fields: [salesDocuments.uploadedById],
        references: [user.id],
    }),
}));

export const competitorPricesRelations = relations(competitorPrices, ({ one }) => ({
    businessConsultant: one(user, {
        fields: [competitorPrices.businessConsultantId],
        references: [user.id],
    }),
    createdBy: one(user, {
        fields: [competitorPrices.createdById],
        references: [user.id],
    }),
}));

export const competitorActivitiesRelations = relations(competitorActivities, ({ one }) => ({
    businessConsultant: one(user, {
        fields: [competitorActivities.businessConsultantId],
        references: [user.id],
    }),
    createdBy: one(user, {
        fields: [competitorActivities.createdById],
        references: [user.id],
    }),
}));

export const lostSalesRelations = relations(lostSales, ({ one }) => ({
    businessConsultant: one(user, {
        fields: [lostSales.businessConsultantId],
        references: [user.id],
    }),
    createdBy: one(user, {
        fields: [lostSales.createdById],
        references: [user.id],
    }),
}));
