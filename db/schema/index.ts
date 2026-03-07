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
export { bundlingHistories } from "./bundling-histories";
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
export * from "./sap";
export { rfidScans } from "./rfid-scans";
export { quotations, quotationItems, quotationsRelations, quotationItemsRelations } from "./quotations";
export { deliveries, deliveryItems, deliveriesRelations, deliveryItemsRelations } from "./deliveries";
export { billingRecords } from "./billing";
export { auditLogs } from "./audit-logs";
export { customers } from "./customers";
export { customerAddresses, customerAddressesRelations } from "./customer-addresses";
export { coverLetters, coverLetterItems } from "./cover-letters";
export { deliveryCostRequests, deliveryCostRequestItems } from "./delivery-cost-requests";
export { salesOrders, salesOrderItems, salesOrdersRelations, salesOrderItemsRelations } from "./sales-orders";
export { goodReceiveManual, goodReceiveManualItems, goodReceiveManualRelations, goodReceiveManualItemsRelations } from "./good-receive-manual";
export { fleetDrivers, fleetVehicles } from "./fleet";
export { fleetTrips, fleetTripsRelations } from "./fleet-trips";
// Old historyOrders removed, aliased from sap.ts below
export { historyOrders as oldHistoryOrdersTable } from "./history-orders";
export { salesDocuments } from "./sales-documents";
export { competitorPrices, competitorActivities, lostSales } from "./competitor-new";
export { stockMovements, stockMovementsRelations } from "./stock-movements";
export { portalItems } from "./portal-items";
export { smtpSettings, emailTemplates, emailLogs, emailTemplateTypeEnum, emailRecipientRoleEnum } from "./email";
export { calendarEvents, calendarEventTypeEnum } from "./calendar-events";
export {
    stockOpnameSessions,
    stockOpnameItems,
    stockOpnameSignatures,
    stockOpnameSessionsRelations,
    stockOpnameItemsRelations,
    stockOpnameSignaturesRelations,
    stockOpnameStatusEnum,
} from "./stock-opname";
export {
    priceLists,
    priceListItems,
    priceHistory,
    priceListTypeEnum,
    priceListsRelations,
    priceListItemsRelations,
    priceHistoryRelations,
} from "./price-management";
export { forecasts } from "./forecasts";
export {
    approvalDefinitionStatusEnum,
    approvalApproverTypeEnum,
    approvalRequestStatusEnum,
    approvalAssignmentStatusEnum,
    approvalDecisionActionEnum,
    approvalOrgStructureTypeEnum,
    approvalFormRegistry,
    approvalDefinitions,
    approvalDefinitionSteps,
    approvalRequests,
    approvalAssignments,
    approvalAuditLogs,
    approvalMatrixImports,
    approvalOrgStructures,
    approvalOrgStructureNodes,
    approvalDefinitionsRelations,
    approvalDefinitionStepsRelations,
    approvalRequestsRelations,
    approvalAssignmentsRelations,
    approvalAuditLogsRelations,
    approvalOrgStructuresRelations,
    approvalOrgStructureNodesRelations,
} from "./approval-workflows";
export {
    costSettlementTypeEnum,
    costSettlementStatusEnum,
    costSettlementCategoryEnum,
    costSettlements,
    costSettlementItems,
    costSettlementReceipts,
    costSettlementSignatories,
    costSettlementsRelations,
    costSettlementItemsRelations,
    costSettlementReceiptsRelations,
    costSettlementSignatoriesRelations,
} from "./cost-settlements";
export { zmc9StockSap, me2lPurchDocsSap, salesRevenueSap, salesRevenueSap as historyOrders, coverLetterSigners } from "./sap";
export { aiInventoryPredictions } from "./ai-predictions";

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
