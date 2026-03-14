import { relations } from "drizzle-orm/relations";
import { user, costSettlementReceipts, deliveryItems, costSettlementItems, costSettlements, coverLetters, coverLetterItems, billingRecords, salesOrderItems, products, rfidScans, warehouses, deliveries, auditLogs, quotationItems, quotations, customers, salesOrders, account, session, stockLevels, stockTransfers, stockTransferItems, approvalDefinitionSteps, approvalRequests, fleetTrips, goodReceiveManual, goodReceiveManualItems, fleetDrivers, fleetVehicles, salesDocuments, competitorActivities, competitorPrices, lostSales, stockOpnameItems, stockOpnameSessions, stockMovements, priceLists, priceListItems, priceHistory, calendarEvents, approvalDefinitions, approvalFormRegistry, approvalOrgStructures, approvalOrgStructureNodes, approvalAssignments, approvalAuditLogs, approvalMatrixImports, customerAddresses, marketingCampaigns, campaignRecipients, permissions, rolePermissions, roles } from "./schema";

export const costSettlementReceiptsRelations = relations(costSettlementReceipts, ({one}) => ({
	user: one(user, {
		fields: [costSettlementReceipts.uploadedBy],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	costSettlementReceipts: many(costSettlementReceipts),
	rfidScans: many(rfidScans),
	auditLogs: many(auditLogs),
	quotations_approvedBy: many(quotations, {
		relationName: "quotations_approvedBy_user_id"
	}),
	quotations_createdBy: many(quotations, {
		relationName: "quotations_createdBy_user_id"
	}),
	quotations_rejectedBy: many(quotations, {
		relationName: "quotations_rejectedBy_user_id"
	}),
	quotations_salesPersonId: many(quotations, {
		relationName: "quotations_salesPersonId_user_id"
	}),
	accounts: many(account),
	sessions: many(session),
	approvalDefinitionSteps: many(approvalDefinitionSteps),
	costSettlements: many(costSettlements),
	deliveries: many(deliveries),
	fleetTrips: many(fleetTrips),
	salesDocuments: many(salesDocuments),
	salesOrders: many(salesOrders),
	competitorActivities_businessConsultantId: many(competitorActivities, {
		relationName: "competitorActivities_businessConsultantId_user_id"
	}),
	competitorActivities_createdById: many(competitorActivities, {
		relationName: "competitorActivities_createdById_user_id"
	}),
	competitorPrices_businessConsultantId: many(competitorPrices, {
		relationName: "competitorPrices_businessConsultantId_user_id"
	}),
	competitorPrices_createdById: many(competitorPrices, {
		relationName: "competitorPrices_createdById_user_id"
	}),
	lostSales_businessConsultantId: many(lostSales, {
		relationName: "lostSales_businessConsultantId_user_id"
	}),
	lostSales_createdById: many(lostSales, {
		relationName: "lostSales_createdById_user_id"
	}),
	stockOpnameItems: many(stockOpnameItems),
	stockMovements: many(stockMovements),
	stockOpnameSessions_closedById: many(stockOpnameSessions, {
		relationName: "stockOpnameSessions_closedById_user_id"
	}),
	stockOpnameSessions_createdById: many(stockOpnameSessions, {
		relationName: "stockOpnameSessions_createdById_user_id"
	}),
	stockOpnameSessions_documentUploadedBy: many(stockOpnameSessions, {
		relationName: "stockOpnameSessions_documentUploadedBy_user_id"
	}),
	priceLists: many(priceLists),
	priceHistories: many(priceHistory),
	calendarEvents: many(calendarEvents),
	approvalDefinitions: many(approvalDefinitions),
	approvalFormRegistries: many(approvalFormRegistry),
	approvalOrgStructures: many(approvalOrgStructures),
	approvalOrgStructureNodes: many(approvalOrgStructureNodes),
	approvalRequests: many(approvalRequests),
	approvalAssignments: many(approvalAssignments),
	approvalAuditLogs: many(approvalAuditLogs),
	approvalMatrixImports: many(approvalMatrixImports),
}));

export const costSettlementItemsRelations = relations(costSettlementItems, ({one}) => ({
	deliveryItem: one(deliveryItems, {
		fields: [costSettlementItems.deliveryItemId],
		references: [deliveryItems.id]
	}),
	costSettlement: one(costSettlements, {
		fields: [costSettlementItems.settlementId],
		references: [costSettlements.id]
	}),
}));

export const deliveryItemsRelations = relations(deliveryItems, ({one, many}) => ({
	costSettlementItems: many(costSettlementItems),
	billingRecords: many(billingRecords),
	delivery: one(deliveries, {
		fields: [deliveryItems.deliveryId],
		references: [deliveries.id]
	}),
	product: one(products, {
		fields: [deliveryItems.productId],
		references: [products.id]
	}),
	salesOrderItem: one(salesOrderItems, {
		fields: [deliveryItems.salesOrderItemId],
		references: [salesOrderItems.id]
	}),
}));

export const costSettlementsRelations = relations(costSettlements, ({one, many}) => ({
	costSettlementItems: many(costSettlementItems),
	approvalRequest: one(approvalRequests, {
		fields: [costSettlements.approvalRequestId],
		references: [approvalRequests.id]
	}),
	user: one(user, {
		fields: [costSettlements.createdBy],
		references: [user.id]
	}),
	delivery: one(deliveries, {
		fields: [costSettlements.deliveryId],
		references: [deliveries.id]
	}),
	fleetTrip: one(fleetTrips, {
		fields: [costSettlements.fleetTripId],
		references: [fleetTrips.id]
	}),
}));

export const coverLetterItemsRelations = relations(coverLetterItems, ({one}) => ({
	coverLetter: one(coverLetters, {
		fields: [coverLetterItems.coverLetterId],
		references: [coverLetters.id]
	}),
}));

export const coverLettersRelations = relations(coverLetters, ({many}) => ({
	coverLetterItems: many(coverLetterItems),
}));

export const billingRecordsRelations = relations(billingRecords, ({one}) => ({
	deliveryItem: one(deliveryItems, {
		fields: [billingRecords.deliveryItemId],
		references: [deliveryItems.id]
	}),
	salesOrderItem: one(salesOrderItems, {
		fields: [billingRecords.salesOrderItemId],
		references: [salesOrderItems.id]
	}),
}));

export const salesOrderItemsRelations = relations(salesOrderItems, ({one, many}) => ({
	billingRecords: many(billingRecords),
	deliveryItems: many(deliveryItems),
	product: one(products, {
		fields: [salesOrderItems.productId],
		references: [products.id]
	}),
	salesOrder: one(salesOrders, {
		fields: [salesOrderItems.salesOrderId],
		references: [salesOrders.id]
	}),
}));

export const rfidScansRelations = relations(rfidScans, ({one}) => ({
	product: one(products, {
		fields: [rfidScans.productId],
		references: [products.id]
	}),
	user: one(user, {
		fields: [rfidScans.userId],
		references: [user.id]
	}),
	warehouse: one(warehouses, {
		fields: [rfidScans.warehouseId],
		references: [warehouses.id]
	}),
}));

export const productsRelations = relations(products, ({many}) => ({
	rfidScans: many(rfidScans),
	deliveryItems: many(deliveryItems),
	quotationItems: many(quotationItems),
	stockLevels: many(stockLevels),
	salesOrderItems: many(salesOrderItems),
	stockTransferItems: many(stockTransferItems),
	goodReceiveManualItems: many(goodReceiveManualItems),
	stockOpnameItems: many(stockOpnameItems),
	stockMovements: many(stockMovements),
	priceListItems: many(priceListItems),
}));

export const warehousesRelations = relations(warehouses, ({many}) => ({
	rfidScans: many(rfidScans),
	stockLevels: many(stockLevels),
	stockTransfers_fromWarehouseId: many(stockTransfers, {
		relationName: "stockTransfers_fromWarehouseId_warehouses_id"
	}),
	stockTransfers_toWarehouseId: many(stockTransfers, {
		relationName: "stockTransfers_toWarehouseId_warehouses_id"
	}),
	goodReceiveManualItems: many(goodReceiveManualItems),
	deliveries_warehouseId: many(deliveries, {
		relationName: "deliveries_warehouseId_warehouses_id"
	}),
	deliveries_warehouseToId: many(deliveries, {
		relationName: "deliveries_warehouseToId_warehouses_id"
	}),
	salesOrders: many(salesOrders),
	stockMovements: many(stockMovements),
	stockOpnameSessions: many(stockOpnameSessions),
}));

export const deliveriesRelations = relations(deliveries, ({one, many}) => ({
	deliveryItems: many(deliveryItems),
	stockTransfers: many(stockTransfers),
	costSettlements: many(costSettlements),
	user: one(user, {
		fields: [deliveries.createdBy],
		references: [user.id]
	}),
	salesOrder: one(salesOrders, {
		fields: [deliveries.salesOrderId],
		references: [salesOrders.id]
	}),
	warehouse_warehouseId: one(warehouses, {
		fields: [deliveries.warehouseId],
		references: [warehouses.id],
		relationName: "deliveries_warehouseId_warehouses_id"
	}),
	warehouse_warehouseToId: one(warehouses, {
		fields: [deliveries.warehouseToId],
		references: [warehouses.id],
		relationName: "deliveries_warehouseToId_warehouses_id"
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(user, {
		fields: [auditLogs.userId],
		references: [user.id]
	}),
}));

export const quotationItemsRelations = relations(quotationItems, ({one}) => ({
	product: one(products, {
		fields: [quotationItems.productId],
		references: [products.id]
	}),
	quotation: one(quotations, {
		fields: [quotationItems.quotationId],
		references: [quotations.id]
	}),
}));

export const quotationsRelations = relations(quotations, ({one, many}) => ({
	quotationItems: many(quotationItems),
	user_approvedBy: one(user, {
		fields: [quotations.approvedBy],
		references: [user.id],
		relationName: "quotations_approvedBy_user_id"
	}),
	user_createdBy: one(user, {
		fields: [quotations.createdBy],
		references: [user.id],
		relationName: "quotations_createdBy_user_id"
	}),
	customer: one(customers, {
		fields: [quotations.customerId],
		references: [customers.id]
	}),
	user_rejectedBy: one(user, {
		fields: [quotations.rejectedBy],
		references: [user.id],
		relationName: "quotations_rejectedBy_user_id"
	}),
	salesOrder: one(salesOrders, {
		fields: [quotations.salesOrderId],
		references: [salesOrders.id]
	}),
	user_salesPersonId: one(user, {
		fields: [quotations.salesPersonId],
		references: [user.id],
		relationName: "quotations_salesPersonId_user_id"
	}),
}));

export const customersRelations = relations(customers, ({many}) => ({
	quotations: many(quotations),
	salesOrders: many(salesOrders),
	priceLists: many(priceLists),
	calendarEvents: many(calendarEvents),
	customerAddresses: many(customerAddresses),
}));

export const salesOrdersRelations = relations(salesOrders, ({one, many}) => ({
	quotations: many(quotations),
	salesOrderItems: many(salesOrderItems),
	deliveries: many(deliveries),
	user: one(user, {
		fields: [salesOrders.createdBy],
		references: [user.id]
	}),
	customer: one(customers, {
		fields: [salesOrders.customerId],
		references: [customers.id]
	}),
	warehouse: one(warehouses, {
		fields: [salesOrders.warehouseId],
		references: [warehouses.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const stockLevelsRelations = relations(stockLevels, ({one}) => ({
	product: one(products, {
		fields: [stockLevels.productId],
		references: [products.id]
	}),
	warehouse: one(warehouses, {
		fields: [stockLevels.warehouseId],
		references: [warehouses.id]
	}),
}));

export const stockTransfersRelations = relations(stockTransfers, ({one, many}) => ({
	delivery: one(deliveries, {
		fields: [stockTransfers.deliveryId],
		references: [deliveries.id]
	}),
	warehouse_fromWarehouseId: one(warehouses, {
		fields: [stockTransfers.fromWarehouseId],
		references: [warehouses.id],
		relationName: "stockTransfers_fromWarehouseId_warehouses_id"
	}),
	warehouse_toWarehouseId: one(warehouses, {
		fields: [stockTransfers.toWarehouseId],
		references: [warehouses.id],
		relationName: "stockTransfers_toWarehouseId_warehouses_id"
	}),
	stockTransferItems: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({one}) => ({
	product: one(products, {
		fields: [stockTransferItems.productId],
		references: [products.id]
	}),
	stockTransfer: one(stockTransfers, {
		fields: [stockTransferItems.transferId],
		references: [stockTransfers.id]
	}),
}));

export const approvalDefinitionStepsRelations = relations(approvalDefinitionSteps, ({one, many}) => ({
	user: one(user, {
		fields: [approvalDefinitionSteps.approverUserId],
		references: [user.id]
	}),
	approvalAssignments: many(approvalAssignments),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({one, many}) => ({
	costSettlements: many(costSettlements),
	approvalDefinition: one(approvalDefinitions, {
		fields: [approvalRequests.definitionId],
		references: [approvalDefinitions.id]
	}),
	user: one(user, {
		fields: [approvalRequests.requesterId],
		references: [user.id]
	}),
	approvalAssignments: many(approvalAssignments),
	approvalAuditLogs: many(approvalAuditLogs),
}));

export const fleetTripsRelations = relations(fleetTrips, ({one, many}) => ({
	costSettlements: many(costSettlements),
	user: one(user, {
		fields: [fleetTrips.createdBy],
		references: [user.id]
	}),
	fleetDriver: one(fleetDrivers, {
		fields: [fleetTrips.driverId],
		references: [fleetDrivers.id]
	}),
	fleetVehicle: one(fleetVehicles, {
		fields: [fleetTrips.vehicleId],
		references: [fleetVehicles.id]
	}),
}));

export const goodReceiveManualItemsRelations = relations(goodReceiveManualItems, ({one}) => ({
	goodReceiveManual: one(goodReceiveManual, {
		fields: [goodReceiveManualItems.headerId],
		references: [goodReceiveManual.id]
	}),
	product: one(products, {
		fields: [goodReceiveManualItems.productId],
		references: [products.id]
	}),
	warehouse: one(warehouses, {
		fields: [goodReceiveManualItems.warehouseId],
		references: [warehouses.id]
	}),
}));

export const goodReceiveManualRelations = relations(goodReceiveManual, ({many}) => ({
	goodReceiveManualItems: many(goodReceiveManualItems),
}));

export const fleetDriversRelations = relations(fleetDrivers, ({many}) => ({
	fleetTrips: many(fleetTrips),
}));

export const fleetVehiclesRelations = relations(fleetVehicles, ({many}) => ({
	fleetTrips: many(fleetTrips),
}));

export const salesDocumentsRelations = relations(salesDocuments, ({one}) => ({
	user: one(user, {
		fields: [salesDocuments.uploadedById],
		references: [user.id]
	}),
}));

export const competitorActivitiesRelations = relations(competitorActivities, ({one}) => ({
	user_businessConsultantId: one(user, {
		fields: [competitorActivities.businessConsultantId],
		references: [user.id],
		relationName: "competitorActivities_businessConsultantId_user_id"
	}),
	user_createdById: one(user, {
		fields: [competitorActivities.createdById],
		references: [user.id],
		relationName: "competitorActivities_createdById_user_id"
	}),
}));

export const competitorPricesRelations = relations(competitorPrices, ({one}) => ({
	user_businessConsultantId: one(user, {
		fields: [competitorPrices.businessConsultantId],
		references: [user.id],
		relationName: "competitorPrices_businessConsultantId_user_id"
	}),
	user_createdById: one(user, {
		fields: [competitorPrices.createdById],
		references: [user.id],
		relationName: "competitorPrices_createdById_user_id"
	}),
}));

export const lostSalesRelations = relations(lostSales, ({one}) => ({
	user_businessConsultantId: one(user, {
		fields: [lostSales.businessConsultantId],
		references: [user.id],
		relationName: "lostSales_businessConsultantId_user_id"
	}),
	user_createdById: one(user, {
		fields: [lostSales.createdById],
		references: [user.id],
		relationName: "lostSales_createdById_user_id"
	}),
}));

export const stockOpnameItemsRelations = relations(stockOpnameItems, ({one}) => ({
	user: one(user, {
		fields: [stockOpnameItems.countedById],
		references: [user.id]
	}),
	product: one(products, {
		fields: [stockOpnameItems.productId],
		references: [products.id]
	}),
	stockOpnameSession: one(stockOpnameSessions, {
		fields: [stockOpnameItems.sessionId],
		references: [stockOpnameSessions.id]
	}),
}));

export const stockOpnameSessionsRelations = relations(stockOpnameSessions, ({one, many}) => ({
	stockOpnameItems: many(stockOpnameItems),
	user_closedById: one(user, {
		fields: [stockOpnameSessions.closedById],
		references: [user.id],
		relationName: "stockOpnameSessions_closedById_user_id"
	}),
	user_createdById: one(user, {
		fields: [stockOpnameSessions.createdById],
		references: [user.id],
		relationName: "stockOpnameSessions_createdById_user_id"
	}),
	user_documentUploadedBy: one(user, {
		fields: [stockOpnameSessions.documentUploadedBy],
		references: [user.id],
		relationName: "stockOpnameSessions_documentUploadedBy_user_id"
	}),
	warehouse: one(warehouses, {
		fields: [stockOpnameSessions.warehouseId],
		references: [warehouses.id]
	}),
}));

export const stockMovementsRelations = relations(stockMovements, ({one}) => ({
	product: one(products, {
		fields: [stockMovements.productId],
		references: [products.id]
	}),
	user: one(user, {
		fields: [stockMovements.recordedBy],
		references: [user.id]
	}),
	warehouse: one(warehouses, {
		fields: [stockMovements.warehouseId],
		references: [warehouses.id]
	}),
}));

export const priceListsRelations = relations(priceLists, ({one, many}) => ({
	user: one(user, {
		fields: [priceLists.createdById],
		references: [user.id]
	}),
	customer: one(customers, {
		fields: [priceLists.customerId],
		references: [customers.id]
	}),
	priceListItems: many(priceListItems),
}));

export const priceListItemsRelations = relations(priceListItems, ({one, many}) => ({
	priceList: one(priceLists, {
		fields: [priceListItems.priceListId],
		references: [priceLists.id]
	}),
	product: one(products, {
		fields: [priceListItems.productId],
		references: [products.id]
	}),
	priceHistories: many(priceHistory),
}));

export const priceHistoryRelations = relations(priceHistory, ({one}) => ({
	user: one(user, {
		fields: [priceHistory.changedById],
		references: [user.id]
	}),
	priceListItem: one(priceListItems, {
		fields: [priceHistory.priceListItemId],
		references: [priceListItems.id]
	}),
}));

export const calendarEventsRelations = relations(calendarEvents, ({one}) => ({
	user: one(user, {
		fields: [calendarEvents.createdBy],
		references: [user.id]
	}),
	customer: one(customers, {
		fields: [calendarEvents.relatedCustomerId],
		references: [customers.id]
	}),
}));

export const approvalDefinitionsRelations = relations(approvalDefinitions, ({one, many}) => ({
	user: one(user, {
		fields: [approvalDefinitions.createdBy],
		references: [user.id]
	}),
	approvalRequests: many(approvalRequests),
}));

export const approvalFormRegistryRelations = relations(approvalFormRegistry, ({one}) => ({
	user: one(user, {
		fields: [approvalFormRegistry.createdBy],
		references: [user.id]
	}),
}));

export const approvalOrgStructuresRelations = relations(approvalOrgStructures, ({one}) => ({
	user: one(user, {
		fields: [approvalOrgStructures.createdBy],
		references: [user.id]
	}),
}));

export const approvalOrgStructureNodesRelations = relations(approvalOrgStructureNodes, ({one}) => ({
	user: one(user, {
		fields: [approvalOrgStructureNodes.userId],
		references: [user.id]
	}),
}));

export const approvalAssignmentsRelations = relations(approvalAssignments, ({one}) => ({
	user: one(user, {
		fields: [approvalAssignments.assigneeUserId],
		references: [user.id]
	}),
	approvalRequest: one(approvalRequests, {
		fields: [approvalAssignments.requestId],
		references: [approvalRequests.id]
	}),
	approvalDefinitionStep: one(approvalDefinitionSteps, {
		fields: [approvalAssignments.stepId],
		references: [approvalDefinitionSteps.id]
	}),
}));

export const approvalAuditLogsRelations = relations(approvalAuditLogs, ({one}) => ({
	user: one(user, {
		fields: [approvalAuditLogs.actorUserId],
		references: [user.id]
	}),
	approvalRequest: one(approvalRequests, {
		fields: [approvalAuditLogs.requestId],
		references: [approvalRequests.id]
	}),
}));

export const approvalMatrixImportsRelations = relations(approvalMatrixImports, ({one}) => ({
	user: one(user, {
		fields: [approvalMatrixImports.importedBy],
		references: [user.id]
	}),
}));

export const customerAddressesRelations = relations(customerAddresses, ({one}) => ({
	customer: one(customers, {
		fields: [customerAddresses.customerId],
		references: [customers.id]
	}),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({one}) => ({
	marketingCampaign: one(marketingCampaigns, {
		fields: [campaignRecipients.campaignId],
		references: [marketingCampaigns.id]
	}),
}));

export const marketingCampaignsRelations = relations(marketingCampaigns, ({many}) => ({
	campaignRecipients: many(campaignRecipients),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));