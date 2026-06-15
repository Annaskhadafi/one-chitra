// Trigger recompile
export { user, session, account, verification } from "./auth";
export { instagramImageHistory } from "./instagram-history";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { warehouses } from "./warehouses";
import { stockLevels } from "./stock-levels";
import { userWarehouseAccess } from "./user-warehouse-access";

export const warehousesRelations = relations(warehouses, ({ many }) => ({
    stocks: many(stockLevels),
    userAccesses: many(userWarehouseAccess),
}));

export const userRelations = relations(user, ({ many }) => ({
    warehouseAccesses: many(userWarehouseAccess),
}));
export { settings } from "./settings";

// Domain tables & Relations
export * from "./campaigns";
export { bundlingHistories } from "./bundling-histories";
export { roles } from "./roles";
export { permissions } from "./permissions";
export { rolePermissions } from "./role-permissions";
export { warehouses } from "./warehouses";
export { userWarehouseAccess, userWarehouseAccessRelations } from "./user-warehouse-access";
export { products } from "./products";
export { productBundleItems, productBundleItemsRelations, productsBundlesRelations } from "./product-bundles";
export { stockLevels, stockLevelsRelations } from "./stock-levels";
export {
    stockCustomerBookings,
    stockBookingConsumptions,
    stockCustomerBookingsRelations,
    stockBookingConsumptionsRelations,
} from "./stock-bookings";
export {
    stockTransfers,
    stockTransferItems,
    stockTransfersRelations,
    stockTransferItemsRelations,
} from "./transfers";
export { sapSyncLogs } from "./sap-sync";
export * from "./sap";
export { rfidScans } from "./rfid-scans";
export {
    quotations,
    quotationItems,
    quotationAttachments,
    quotationRevisions,
    quotationsRelations,
    quotationItemsRelations,
    quotationAttachmentsRelations,
    quotationRevisionsRelations,
} from "./quotations";
export { deliveries, deliveryItems, deliveriesRelations, deliveryItemsRelations } from "./deliveries";
export { billingRecords } from "./billing";
export { auditLogs, auditLogsRelations } from "./audit-logs";
export { customers } from "./customers";
export { customerAddresses, customerAddressesRelations } from "./customer-addresses";
export { coverLetters, coverLetterItems } from "./cover-letters";
export { deliveryCostRequests, deliveryCostRequestItems, deliveryCostCredits } from "./delivery-cost-requests";
export { salesOrders, salesOrderItems, salesOrdersRelations, salesOrderItemsRelations } from "./sales-orders";
export { goodReceiveManual, goodReceiveManualItems, goodReceiveManualRelations, goodReceiveManualItemsRelations } from "./good-receive-manual";
export { fleetDrivers, fleetVehicles } from "./fleet";
export { fleetTrips, fleetTripsRelations } from "./fleet-trips";
// Old historyOrders removed, aliased from sap.ts below
export { historyOrders as oldHistoryOrdersTable } from "./history-orders";
export { salesDocuments } from "./sales-documents";
export { ocrPoSessions } from "./ocr-po-sessions";
export { competitorPrices, competitorActivities, lostSales } from "./competitor-new";
export { stockMovements, stockMovementsRelations } from "./stock-movements";
export { portalItems } from "./portal-items";
export {
    surveyFormKindEnum,
    surveyFormStatusEnum,
    surveyForms,
    surveyResponses,
    surveyFormsRelations,
    surveyResponsesRelations,
} from "./forms-surveys";
export { smtpSettings, emailTemplates, emailLogs, emailTemplateTypeEnum, emailRecipientRoleEnum, emailNotificationRules, emailNotificationRuleStates, emailNotificationRuleLogs } from "./email";
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
export { logisticsMasterPrices } from "./logistics-master-prices";
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
export { marketingCampaigns, campaignRecipients, marketingCampaignsRelations, campaignRecipientsRelations } from "./marketing-campaigns";
export { slowMovingProducts, slowMovingProductsRelations } from "./slow-moving-products";
export { cosmeticTires, cosmeticTiresRelations } from "./cosmetic-tires";
export { tirePerformanceRecords, tirePerformanceRecordsRelations } from "./tire-performance";
export { rmiRecords, quarterlyExchangeRates, rmiWeights, rmiRecordsRelations, quarterlyExchangeRatesRelations, rmiWeightsRelations } from "./rmi";
export { repairMasterItems, repairMasterSites } from "./repair-master";
export { zmc9StockSap, me2lPurchDocsSap, zvendorPoReportSap, salesRevenueSap, salesRevenueSap as historyOrders, coverLetterSigners } from "./sap";
export { aiInventoryPredictions, restockNotifications, aiSettings } from "./ai-predictions";
export { inventoryVendorLeadTimes, inventoryVendorLeadTimeMaterials } from "./inventory-vendors";
export {
    evhsReceipts,
    evhsReceiptItems,
    evhsVouchers,
    evhsVoucherItems,
    evhsGiRecords,
    evhsGiItems,
    evhsMrko,
    evhsMasterPrices,
    evhsReceiptsRelations,
    evhsReceiptItemsRelations,
    evhsVouchersRelations,
    evhsVoucherItemsRelations,
    evhsGiRecordsRelations,
    evhsGiItemsRelations,
    evhsMasterPricesRelations,
} from "./evhs";
export { ocrExtractions } from "./ocr-extractions";
export {
    vendorQuotations,
    vendorQuotationItems,
    vendorQuotationsRelations,
    vendorQuotationItemsRelations,
    vendorQuotationOcrStatusEnum,
} from "./vendor-quotations";
export {
    emailGroups,
    emailContacts,
    emailGroupMembers,
    contactCategoryEnum,
    emailGroupsRelations,
    emailContactsRelations,
    emailGroupMembersRelations,
} from "./email-contacts";
export { userNotificationReads } from "./user-notifications";
export { pushSubscriptions } from "./push-subscriptions";
export {
    chatRooms,
    chatRoomMembers,
    chatMessages,
    chatUserStickers,
    chatRoomsRelations,
    chatRoomMembersRelations,
    chatMessagesRelations,
    chatUserStickersRelations,
    type ChatAttachmentRecord,
    type ChatReactionRecord,
    type ChatSavedStickerRecord,
} from "./chat";
export {
    helpdeskKnowledgeSources,
    helpdeskKnowledgeChunks,
    helpdeskTrainingLogs,
    helpdeskKnowledgeSourcesRelations,
    helpdeskKnowledgeChunksRelations,
    helpdeskTrainingLogsRelations,
} from "./helpdesk-ai";
export { businessCards } from "./business-cards";

// Core Auth Table Relations
import { salesDocuments } from "./sales-documents";
import { ocrPoSessions } from "./ocr-po-sessions";
import { competitorPrices, competitorActivities, lostSales } from "./competitor-new";

export const salesDocumentsRelations = relations(salesDocuments, ({ one }) => ({
    uploadedBy: one(user, {
        fields: [salesDocuments.uploadedById],
        references: [user.id],
    }),
}));

export const ocrPoSessionsRelations = relations(ocrPoSessions, ({ one }) => ({
    uploadedBy: one(user, {
        fields: [ocrPoSessions.uploadedById],
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
