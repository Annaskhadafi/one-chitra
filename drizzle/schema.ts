import { pgTable, index, serial, varchar, text, integer, timestamp, real, date, doublePrecision, foreignKey, numeric, uuid, jsonb, unique, boolean, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const approvalApproverType = pgEnum("approval_approver_type", ['role', 'user'])
export const approvalAssignmentStatus = pgEnum("approval_assignment_status", ['pending', 'approved', 'rejected', 'skipped'])
export const approvalDecisionAction = pgEnum("approval_decision_action", ['approve', 'reject', 'comment', 'escalate', 'cancel'])
export const approvalDefinitionStatus = pgEnum("approval_definition_status", ['draft', 'active', 'archived'])
export const approvalOrgStructureType = pgEnum("approval_org_structure_type", ['enterprise', 'work', 'project'])
export const approvalRequestStatus = pgEnum("approval_request_status", ['pending', 'approved', 'rejected', 'cancelled'])
export const calendarEventType = pgEnum("calendar_event_type", ['marketing', 'reminder'])
export const costSettlementCategory = pgEnum("cost_settlement_category", ['gasoline', 'toll', 'parking', 'meals', 'maintenance', 'others', 'rapid_test', 'ferry', 'portal', 'washing', 'escort'])
export const costSettlementStatus = pgEnum("cost_settlement_status", ['draft', 'submitted', 'approved', 'rejected', 'posted'])
export const costSettlementType = pgEnum("cost_settlement_type", ['trip', 'delivery'])
export const emailRecipientRole = pgEnum("email_recipient_role", ['admin', 'manager', 'staff', 'customer', 'all'])
export const emailTemplateType = pgEnum("email_template_type", ['magic_link', 'notification', 'welcome', 'password_reset', 'order_confirmation', 'delivery_update', 'custom'])
export const priceListType = pgEnum("price_list_type", ['tier', 'customer', 'promotional'])
export const stockOpnameStatus = pgEnum("stock_opname_status", ['open', 'closed', 'cancelled'])


export const aiInventoryPredictions = pgTable("ai_inventory_predictions", {
	id: serial().primaryKey().notNull(),
	productCode: varchar("product_code", { length: 100 }).notNull(),
	productName: text("product_name"),
	predictionType: varchar("prediction_type", { length: 50 }).notNull(),
	recommendedStock: integer("recommended_stock").notNull(),
	rationale: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	actualSales: integer("actual_sales"),
	accuracyPercentage: real("accuracy_percentage"),
	batchId: varchar("batch_id", { length: 100 }),
	currentStock: integer("current_stock"),
}, (table) => [
	index("ai_predictions_accuracy_idx").using("btree", table.accuracyPercentage.asc().nullsLast().op("float4_ops")),
	index("ai_predictions_batch_id_idx").using("btree", table.batchId.asc().nullsLast().op("text_ops")),
	index("ai_predictions_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("ai_predictions_product_code_idx").using("btree", table.productCode.asc().nullsLast().op("text_ops")),
	index("ai_predictions_type_idx").using("btree", table.predictionType.asc().nullsLast().op("text_ops")),
]);

export const restockNotifications = pgTable("restock_notifications", {
	id: serial().primaryKey().notNull(),
	productCode: varchar("product_code", { length: 100 }).notNull(),
	productName: text("product_name"),
	currentStock: integer("current_stock").notNull(),
	recommendedStock: integer("recommended_stock").notNull(),
	urgencyLevel: varchar("urgency_level", { length: 20 }).notNull(),
	predictionId: integer("prediction_id"),
	isAcknowledged: integer("is_acknowledged").default(0).notNull(),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notifications_acknowledged_idx").using("btree", table.isAcknowledged.asc().nullsLast().op("int4_ops")),
	index("notifications_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("notifications_product_code_idx").using("btree", table.productCode.asc().nullsLast().op("text_ops")),
	index("notifications_urgency_idx").using("btree", table.urgencyLevel.asc().nullsLast().op("text_ops")),
]);

export const coverLetterSigners = pgTable("cover_letter_signers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	title: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const aiSettings = pgTable("ai_settings", {
	id: serial().primaryKey().notNull(),
	settingKey: varchar("setting_key", { length: 100 }).notNull(),
	settingValue: text("setting_value").notNull(),
	description: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 100 }),
});

export const me2LPurchDocsSap = pgTable("me2l_purch_docs_sap", {
	purchDocId: integer("purch_doc_id").primaryKey().notNull(),
	purchasingDoc: text("purchasing_doc"),
	vendorName: text("vendor_name"),
	material: text(),
	trackingNo: text("tracking_no"),
	poHistory: text("po_history"),
	item: integer(),
	docType: text("doc_type"),
	docCat: text("doc_cat"),
	storageLoc: text("storage_loc"),
	purchGroup: text("purch_group"),
	docDate: date("doc_date"),
	shortText: text("short_text"),
	materialGroup: text("material_group"),
	plant: text(),
	orderQty: doublePrecision("order_qty"),
	orderUnit: text("order_unit"),
	netPrice: doublePrecision("net_price"),
	currency: text(),
	priceUnit: integer("price_unit"),
	deliveredQty: doublePrecision("delivered_qty"),
	deliveredVal: doublePrecision("delivered_val"),
	invoicedQty: doublePrecision("invoiced_qty"),
	invoicedVal: doublePrecision("invoiced_val"),
	netOrderValue: doublePrecision("net_order_value"),
	purchOrg: text("purch_org"),
	releaseState: text("release_state"),
	extractedAt: timestamp("extracted_at", { mode: 'string' }),
	grProcessedDate: timestamp("gr_processed_date", { mode: 'string' }),
	grWarehouseId: integer("gr_warehouse_id"),
}, (table) => [
	index("doc_date_idx").using("btree", table.docDate.asc().nullsLast().op("date_ops")),
]);

export const marketingCampaigns = pgTable("marketing_campaigns", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	subject: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	segmentCriteria: text("segment_criteria"),
	scheduledAt: timestamp("scheduled_at", { mode: 'string' }),
	status: varchar({ length: 50 }).default('draft').notNull(),
	totalRecipients: integer("total_recipients").default(0),
	successCount: integer("success_count").default(0),
	failureCount: integer("failure_count").default(0),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	description: text(),
	channelType: varchar("channel_type", { length: 50 }).default('email').notNull(),
	ccEmails: text("cc_emails"),
	sentAt: timestamp("sent_at", { mode: 'string' }),
});

export const costSettlementReceipts = pgTable("cost_settlement_receipts", {
	id: serial().primaryKey().notNull(),
	settlementItemId: integer("settlement_item_id").notNull(),
	fileUrl: varchar("file_url", { length: 255 }).notNull(),
	originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
	fileSize: integer("file_size").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	uploadedBy: varchar("uploaded_by").notNull(),
}, (table) => [
	index("cost_settlement_receipts_item_idx").using("btree", table.settlementItemId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [user.id],
			name: "cost_settlement_receipts_uploaded_by_user_id_fk"
		}),
]);

export const costSettlementSignatories = pgTable("cost_settlement_signatories", {
	id: serial().primaryKey().notNull(),
	settlementId: integer("settlement_id").notNull(),
	signatoryName: varchar("signatory_name", { length: 255 }).notNull(),
	signatoryPosition: varchar("signatory_position", { length: 255 }).notNull(),
	signatoryRole: varchar("signatory_role", { length: 100 }).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cost_settlement_signatories_settlement_idx").using("btree", table.settlementId.asc().nullsLast().op("int4_ops")),
]);

export const costSettlementItems = pgTable("cost_settlement_items", {
	id: serial().primaryKey().notNull(),
	settlementId: integer("settlement_id").notNull(),
	costCategory: costSettlementCategory("cost_category").notNull(),
	description: varchar({ length: 255 }).notNull(),
	amount: numeric({ precision: 15, scale:  2 }).default('0').notNull(),
	receiptDate: date("receipt_date"),
	vendorName: varchar("vendor_name", { length: 255 }),
	deliveryItemId: integer("delivery_item_id"),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cost_settlement_items_category_idx").using("btree", table.costCategory.asc().nullsLast().op("enum_ops")),
	index("cost_settlement_items_settlement_idx").using("btree", table.settlementId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.deliveryItemId],
			foreignColumns: [deliveryItems.id],
			name: "cost_settlement_items_delivery_item_id_delivery_items_id_fk"
		}),
	foreignKey({
			columns: [table.settlementId],
			foreignColumns: [costSettlements.id],
			name: "cost_settlement_items_settlement_id_cost_settlements_id_fk"
		}).onDelete("cascade"),
]);

export const coverLetterItems = pgTable("cover_letter_items", {
	id: serial().primaryKey().notNull(),
	coverLetterId: integer("cover_letter_id"),
	poNo: text("po_no"),
	noInvSap: text("no_inv_sap"),
	dateInvoice: timestamp("date_invoice", { mode: 'string' }),
	datePo: timestamp("date_po", { mode: 'string' }),
	amountBeforeTax: numeric("amount_before_tax", { precision: 15, scale:  2 }),
	amountIncludeTax: numeric("amount_include_tax", { precision: 15, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.coverLetterId],
			foreignColumns: [coverLetters.id],
			name: "cover_letter_items_cover_letter_id_cover_letters_id_fk"
		}).onDelete("cascade"),
]);

export const coverLetters = pgTable("cover_letters", {
	id: serial().primaryKey().notNull(),
	refNumber: text("ref_number"),
	letterDate: timestamp("letter_date", { mode: 'string' }),
	custId: text("cust_id"),
	customerName: text("customer_name"),
	signerName: text("signer_name"),
	signerTitle: text("signer_title"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	location: text().default('balikpapan'),
});

export const bundlingHistories = pgTable("bundling_histories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	scenarioName: text("scenario_name").notNull(),
	itemsData: jsonb("items_data").notNull(),
	competitorPrice: numeric("competitor_price").default('0').notNull(),
	targetMarginPercentage: numeric("target_margin_percentage").notNull(),
	recommendedQtyPrimary: numeric("recommended_qty_primary").default('0').notNull(),
	finalMarginAmount: numeric("final_margin_amount").notNull(),
	finalMarginPercentage: numeric("final_margin_percentage").notNull(),
	status: text(),
	createdById: text("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const billingRecords = pgTable("billing_records", {
	id: serial().primaryKey().notNull(),
	deliveryItemId: integer("delivery_item_id"),
	salesOrderItemId: integer("sales_order_item_id"),
	no: text(),
	year: integer(),
	month: text(),
	plant: text(),
	customer: text(),
	poNo: text("po_no"),
	datePo: timestamp("date_po", { mode: 'string' }),
	materialNumber: text("material_number"),
	materialDescription: text("material_description"),
	qty: numeric({ precision: 15, scale:  2 }).default('0'),
	curr: text(),
	pricePerPcsIdr: numeric("price_per_pcs_idr", { precision: 15, scale:  2 }).default('0'),
	totalPriceIdr: numeric("total_price_idr", { precision: 15, scale:  2 }).default('0'),
	ppn: numeric({ precision: 15, scale:  2 }).default('0'),
	price: numeric({ precision: 15, scale:  2 }).default('0'),
	includePpn: numeric("include_ppn", { precision: 15, scale:  2 }).default('0'),
	noInvSap: text("no_inv_sap"),
	dateInvoice: timestamp("date_invoice", { mode: 'string' }),
	custId: text("cust_id"),
	salesName: text("sales_name"),
	ddpAddress: text("ddp_address"),
	paymentType: text("payment_type"),
	nomorDoSap: text("nomor_do_sap"),
	actualNoDo: text("actual_no_do"),
	tglDoFaktur: timestamp("tgl_do_faktur", { mode: 'string' }),
	remaks: text(),
	dateSendInvoice: timestamp("date_send_invoice", { mode: 'string' }),
	receiverDate: timestamp("receiver_date", { mode: 'string' }),
	recvDateApproved: timestamp("recv_date_approved", { mode: 'string' }),
	eFaktur: text("e_faktur"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	modeDelivery: text("mode_delivery"),
	noResi: text("no_resi"),
	statusDelivery: text("status_delivery"),
	scanInvUrl: text("scan_inv_url"),
	evoucherId: integer("evoucher_id"),
	invoiceType: text("invoice_type"),
}, (table) => [
	foreignKey({
			columns: [table.deliveryItemId],
			foreignColumns: [deliveryItems.id],
			name: "billing_records_delivery_item_id_delivery_items_id_fk"
		}),
	foreignKey({
			columns: [table.salesOrderItemId],
			foreignColumns: [salesOrderItems.id],
			name: "billing_records_sales_order_item_id_sales_order_items_id_fk"
		}),
]);

export const rfidScans = pgTable("rfid_scans", {
	id: serial().primaryKey().notNull(),
	tagId: varchar("tag_id", { length: 100 }).notNull(),
	productId: integer("product_id"),
	warehouseId: integer("warehouse_id"),
	scanType: varchar("scan_type", { length: 10 }),
	userId: varchar("user_id"),
	scannedAt: timestamp("scanned_at", { mode: 'string' }).defaultNow().notNull(),
	serialNumber: varchar("serial_number", { length: 200 }),
	category: varchar({ length: 100 }),
	referenceNo: varchar("reference_no", { length: 100 }),
	notes: text(),
	deviceId: varchar("device_id", { length: 100 }),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "rfid_scans_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "rfid_scans_user_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "rfid_scans_warehouse_id_warehouses_id_fk"
		}),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	category: varchar({ length: 100 }).notNull(),
	materialNumber: varchar("material_number", { length: 100 }).notNull(),
	oldMaterialNo: text("old_material_no"),
	materialDescription: text("material_description"),
	costSap: text("cost_sap"),
	imageUrl: text("image_url"),
	plant: varchar({ length: 100 }),
	sloc: varchar({ length: 100 }),
	slocDescription: text("sloc_description"),
	typeWarehouse: varchar("type_warehouse", { length: 50 }),
	brand: varchar({ length: 100 }),
	isConsignment: boolean("is_consignment").default(false).notNull(),
	materialNumberCk: varchar("material_number_ck", { length: 100 }),
}, (table) => [
	unique("unq_material_sloc").on(table.materialNumber, table.sloc),
]);

export const deliveryItems = pgTable("delivery_items", {
	id: serial().primaryKey().notNull(),
	deliveryId: integer("delivery_id").notNull(),
	productId: integer("product_id").notNull(),
	salesOrderItemId: integer("sales_order_item_id"),
	orderedQuantity: integer("ordered_quantity").default(0).notNull(),
	deliveredQuantity: integer("delivered_quantity").default(0).notNull(),
	serialNumbers: text("serial_numbers").array(),
}, (table) => [
	foreignKey({
			columns: [table.deliveryId],
			foreignColumns: [deliveries.id],
			name: "delivery_items_delivery_id_deliveries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "delivery_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.salesOrderItemId],
			foreignColumns: [salesOrderItems.id],
			name: "delivery_items_sales_order_item_id_sales_order_items_id_fk"
		}),
]);

export const auditLogs = pgTable("audit_logs", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id"),
	action: varchar({ length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "audit_logs_user_id_user_id_fk"
		}),
]);

export const quotationItems = pgTable("quotation_items", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	productId: integer("product_id"),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 12, scale:  2 }).notNull(),
	discount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	tax: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	description: text(),
	longDescription: text("long_description"),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "quotation_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [quotations.id],
			name: "quotation_items_quotation_id_quotations_id_fk"
		}).onDelete("cascade"),
]);

export const customers = pgTable("customers", {
	id: serial().primaryKey().notNull(),
	customerCode: varchar("customer_code", { length: 100 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	contactName: varchar("contact_name", { length: 255 }),
	email: varchar({ length: 255 }),
	address1: text("address_1"),
	address2: text("address_2"),
	address3: text("address_3"),
	address4: text("address_4"),
	address5: text("address_5"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	birthday: date(),
}, (table) => [
	unique("customers_customer_code_unique").on(table.customerCode),
]);

export const quotations = pgTable("quotations", {
	id: serial().primaryKey().notNull(),
	createdBy: varchar("created_by").notNull(),
	status: varchar({ length: 50 }).default('draft').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvedBy: varchar("approved_by"),
	quotationNumber: varchar("quotation_number", { length: 50 }),
	customerId: integer("customer_id").notNull(),
	quotationDate: timestamp("quotation_date", { mode: 'string' }).defaultNow().notNull(),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	subject: varchar({ length: 500 }),
	paymentTerms: text("payment_terms"),
	termsConditions: text("terms_conditions"),
	notes: text(),
	discount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	tax: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	shipping: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	salesOrderId: integer("sales_order_id"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	rejectedBy: varchar("rejected_by"),
	rejectionReason: text("rejection_reason"),
	salesPersonId: text("sales_person_id"),
	attn: varchar({ length: 200 }),
	address: text(),
	closingStatus: varchar("closing_status", { length: 50 }),
	tags: text(),
	currency: varchar({ length: 10 }).default('IDR'),
	referenceNumber: varchar("reference_number", { length: 100 }),
	adminNote: text("admin_note"),
	clientNote: text("client_note"),
	discountType: varchar("discount_type", { length: 20 }).default('fixed'),
}, (table) => [
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [user.id],
			name: "quotations_approved_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "quotations_created_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "quotations_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.rejectedBy],
			foreignColumns: [user.id],
			name: "quotations_rejected_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.salesOrderId],
			foreignColumns: [salesOrders.id],
			name: "quotations_sales_order_id_sales_orders_id_fk"
		}),
	foreignKey({
			columns: [table.salesPersonId],
			foreignColumns: [user.id],
			name: "quotations_sales_person_id_user_id_fk"
		}),
	unique("quotations_quotation_number_unique").on(table.quotationNumber),
]);

export const permissions = pgTable("permissions", {
	id: serial().primaryKey().notNull(),
	resource: varchar({ length: 50 }).notNull(),
	action: varchar({ length: 50 }).notNull(),
	description: text(),
});

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const warehouses = pgTable("warehouses", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	sloc: varchar({ length: 50 }).notNull(),
	description: text(),
	type: varchar({ length: 50 }),
	customerId: integer("customer_id"),
}, (table) => [
	unique("warehouses_sloc_unique").on(table.sloc),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	impersonatedBy: text("impersonated_by"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const sapSyncLogs = pgTable("sap_sync_logs", {
	id: serial().primaryKey().notNull(),
	syncType: varchar("sync_type", { length: 50 }),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { mode: 'string' }),
	status: varchar({ length: 50 }),
	notes: text(),
});

export const stockLevels = pgTable("stock_levels", {
	id: serial().primaryKey().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	productId: integer("product_id").notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	valuationValue: numeric("valuation_value", { precision: 20, scale:  2 }).default('0').notNull(),
	totalStock: integer("total_stock").default(0).notNull(),
	minStock: integer("min_stock").default(0).notNull(),
	bookedStock: integer("booked_stock").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	draftBookedStock: integer("draft_booked_stock").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_levels_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_levels_warehouse_id_warehouses_id_fk"
		}),
]);

export const stockTransfers = pgTable("stock_transfers", {
	id: serial().primaryKey().notNull(),
	referenceNumber: varchar("reference_number", { length: 50 }),
	fromWarehouseId: integer("from_warehouse_id").notNull(),
	toWarehouseId: integer("to_warehouse_id").notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	notes: text(),
	transferDate: timestamp("transfer_date", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deliveryId: integer("delivery_id"),
	receivedStatus: varchar("received_status", { length: 20 }).default('Scheduled').notNull(),
	postingDocumentNo: varchar("posting_document_no", { length: 100 }),
	batchNo: varchar("batch_no", { length: 100 }),
}, (table) => [
	foreignKey({
			columns: [table.deliveryId],
			foreignColumns: [deliveries.id],
			name: "stock_transfers_delivery_id_deliveries_id_fk"
		}),
	foreignKey({
			columns: [table.fromWarehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_transfers_from_warehouse_id_warehouses_id_fk"
		}),
	foreignKey({
			columns: [table.toWarehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_transfers_to_warehouse_id_warehouses_id_fk"
		}),
	unique("stock_transfers_reference_number_unique").on(table.referenceNumber),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const salesOrderItems = pgTable("sales_order_items", {
	id: serial().primaryKey().notNull(),
	salesOrderId: integer("sales_order_id").notNull(),
	productId: integer("product_id"),
	quantity: integer().default(1).notNull(),
	unitPrice: numeric("unit_price", { precision: 12, scale:  2 }).default('0').notNull(),
	discount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	tax: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sales_order_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.salesOrderId],
			foreignColumns: [salesOrders.id],
			name: "sales_order_items_sales_order_id_sales_orders_id_fk"
		}).onDelete("cascade"),
]);

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 50 }).notNull(),
	description: text(),
}, (table) => [
	unique("roles_name_unique").on(table.name),
]);

export const stockTransferItems = pgTable("stock_transfer_items", {
	id: serial().primaryKey().notNull(),
	transferId: integer("transfer_id").notNull(),
	productId: integer("product_id").notNull(),
	quantity: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_transfer_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.transferId],
			foreignColumns: [stockTransfers.id],
			name: "stock_transfer_items_transfer_id_stock_transfers_id_fk"
		}).onDelete("cascade"),
]);

export const approvalDefinitionSteps = pgTable("approval_definition_steps", {
	id: serial().primaryKey().notNull(),
	definitionId: varchar("definition_id", { length: 36 }).notNull(),
	stepOrder: integer("step_order").notNull(),
	stepName: varchar("step_name", { length: 200 }).notNull(),
	approverType: approvalApproverType("approver_type").default('role').notNull(),
	approverRole: varchar("approver_role", { length: 100 }),
	approverUserId: text("approver_user_id"),
	minApprovals: integer("min_approvals").default(1).notNull(),
	conditionJson: jsonb("condition_json").default({}),
	isRequired: boolean("is_required").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	notifyOnAssign: boolean("notify_on_assign").default(true).notNull(),
	notifyOnComplete: boolean("notify_on_complete").default(false).notNull(),
	ccEmails: text("cc_emails"),
	slaDays: integer("sla_days"),
	nodePositionX: integer("node_position_x").default(0),
	nodePositionY: integer("node_position_y").default(0),
}, (table) => [
	index("approval_steps_definition_idx").using("btree", table.definitionId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.approverUserId],
			foreignColumns: [user.id],
			name: "approval_definition_steps_approver_user_id_user_id_fk"
		}),
	unique("approval_steps_unique_order").on(table.definitionId, table.stepOrder),
]);

export const zmc9StockSap = pgTable("zmc9_stock_sap", {
	stockId: integer("stock_id").primaryKey().notNull(),
	plantCode: text("plant_code"),
	plantName: text("plant_name"),
	materialNo: text("material_no"),
	oldMaterialNo: text("old_material_no"),
	materialDesc: text("material_desc"),
	storLoc: text("stor_loc"),
	storLocDesc: text("stor_loc_desc"),
	totalStock: doublePrecision("total_stock"),
	baseUnitOfMeasure: text("base_unit_of_measure"),
	valueStock: numeric("value_stock", { precision: 18, scale:  2 }),
	currency: text(),
	extractedAt: timestamp("extracted_at", { mode: 'string' }),
});

export const costSettlements = pgTable("cost_settlements", {
	id: serial().primaryKey().notNull(),
	settlementNumber: varchar("settlement_number", { length: 50 }).notNull(),
	settlementType: costSettlementType("settlement_type").notNull(),
	fleetTripId: integer("fleet_trip_id"),
	deliveryId: integer("delivery_id"),
	driverName: varchar("driver_name", { length: 255 }),
	vehicleNumber: varchar("vehicle_number", { length: 50 }),
	advanceAmount: numeric("advance_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	totalActualAmount: numeric("total_actual_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	varianceAmount: numeric("variance_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	status: costSettlementStatus().default('draft').notNull(),
	approvalRequestId: varchar("approval_request_id", { length: 36 }),
	settlementDate: date("settlement_date").notNull(),
	remarks: text(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
}, (table) => [
	index("cost_settlements_delivery_idx").using("btree", table.deliveryId.asc().nullsLast().op("int4_ops")),
	index("cost_settlements_settlement_date_idx").using("btree", table.settlementDate.asc().nullsLast().op("date_ops")),
	index("cost_settlements_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("cost_settlements_trip_idx").using("btree", table.fleetTripId.asc().nullsLast().op("int4_ops")),
	index("cost_settlements_type_idx").using("btree", table.settlementType.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.approvalRequestId],
			foreignColumns: [approvalRequests.id],
			name: "cost_settlements_approval_request_id_approval_requests_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "cost_settlements_created_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.deliveryId],
			foreignColumns: [deliveries.id],
			name: "cost_settlements_delivery_id_deliveries_id_fk"
		}),
	foreignKey({
			columns: [table.fleetTripId],
			foreignColumns: [fleetTrips.id],
			name: "cost_settlements_fleet_trip_id_fleet_trips_id_fk"
		}),
	unique("cost_settlements_settlement_number_unique").on(table.settlementNumber),
]);

export const settings = pgTable("settings", {
	key: varchar({ length: 50 }).primaryKey().notNull(),
	value: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	image: text(),
	role: text().default('staff').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	banned: boolean().default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { mode: 'string' }),
	department: text(),
	jobTitle: text("job_title"),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const goodReceiveManual = pgTable("good_receive_manual", {
	id: serial().primaryKey().notNull(),
	supplier: text().notNull(),
	poNumber: text("po_number").notNull(),
	receiveDate: date("receive_date").notNull(),
	deliveryType: text("delivery_type").notNull(),
	referenceDocument: text("reference_document"),
	vendorDoUrl: text("vendor_do_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const goodReceiveManualItems = pgTable("good_receive_manual_items", {
	id: serial().primaryKey().notNull(),
	headerId: integer("header_id").notNull(),
	productId: integer("product_id").notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	quantity: integer().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.headerId],
			foreignColumns: [goodReceiveManual.id],
			name: "good_receive_manual_items_header_id_good_receive_manual_id_fk"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "good_receive_manual_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "good_receive_manual_items_warehouse_id_warehouses_id_fk"
		}),
]);

export const deliveries = pgTable("deliveries", {
	id: serial().primaryKey().notNull(),
	deliveryDate: timestamp("delivery_date", { mode: 'string' }),
	status: varchar({ length: 20 }).default('scheduled').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	deliveryNumber: varchar("delivery_number", { length: 50 }),
	salesOrderId: integer("sales_order_id").notNull(),
	scheduledDate: timestamp("scheduled_date", { mode: 'string' }).notNull(),
	deliveryType: varchar("delivery_type", { length: 20 }).default('full').notNull(),
	driverName: varchar("driver_name", { length: 255 }),
	vehicleNumber: varchar("vehicle_number", { length: 50 }),
	vehicleType: varchar("vehicle_type", { length: 50 }),
	warehouseId: integer("warehouse_id"),
	shippingAddress: text("shipping_address"),
	notes: text(),
	createdBy: varchar("created_by"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isExternal: boolean("is_external").default(false).notNull(),
	vendorName: varchar("vendor_name", { length: 255 }),
	awbNumber: varchar("awb_number", { length: 100 }),
	shippingCost: numeric("shipping_cost", { precision: 15, scale:  2 }).default('0'),
	costGasoline: numeric("cost_gasoline", { precision: 15, scale:  2 }).default('0'),
	costToll: numeric("cost_toll", { precision: 15, scale:  2 }).default('0'),
	costParking: numeric("cost_parking", { precision: 15, scale:  2 }).default('0'),
	costMeals: numeric("cost_meals", { precision: 15, scale:  2 }).default('0'),
	costMaintenance: numeric("cost_maintenance", { precision: 15, scale:  2 }).default('0'),
	costOthers: numeric("cost_others", { precision: 15, scale:  2 }).default('0'),
	fleetTripId: integer("fleet_trip_id"),
	returnDoDate: timestamp("return_do_date", { mode: 'string' }),
	invoiceNumber: varchar("invoice_number", { length: 100 }),
	invoiceDate: timestamp("invoice_date", { mode: 'string' }),
	doStatus: varchar("do_status", { length: 50 }).default('Pending'),
	remark: text(),
	scanDoDocument: varchar("scan_do_document", { length: 255 }),
	contactName: varchar("contact_name", { length: 255 }),
	contactEmail: varchar("contact_email", { length: 255 }),
	contactPhone: varchar("contact_phone", { length: 50 }),
	contactPerson: varchar("contact_person", { length: 255 }),
	warehouseToId: integer("warehouse_to_id"),
	doSap: varchar("do_sap", { length: 100 }),
	tripDestination: varchar("trip_destination", { length: 255 }),
	costRapidTest: numeric("cost_rapid_test", { precision: 15, scale:  2 }).default('0'),
	costFerry: numeric("cost_ferry", { precision: 15, scale:  2 }).default('0'),
	costPortal: numeric("cost_portal", { precision: 15, scale:  2 }).default('0'),
	costWashing: numeric("cost_washing", { precision: 15, scale:  2 }).default('0'),
	costEscort: numeric("cost_escort", { precision: 15, scale:  2 }).default('0'),
	costGasolineDexlite: numeric("cost_gasoline_dexlite", { precision: 15, scale:  2 }).default('0'),
	costGasolineBio: numeric("cost_gasoline_bio", { precision: 15, scale:  2 }).default('0'),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "deliveries_created_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.salesOrderId],
			foreignColumns: [salesOrders.id],
			name: "deliveries_sales_order_id_sales_orders_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "deliveries_warehouse_id_warehouses_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseToId],
			foreignColumns: [warehouses.id],
			name: "deliveries_warehouse_to_id_warehouses_id_fk"
		}),
	unique("deliveries_delivery_number_unique").on(table.deliveryNumber),
]);

export const fleetTrips = pgTable("fleet_trips", {
	id: serial().primaryKey().notNull(),
	tripNumber: varchar("trip_number", { length: 50 }).notNull(),
	driverId: integer("driver_id"),
	vehicleId: integer("vehicle_id"),
	status: varchar({ length: 20 }).default('scheduled').notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	notes: text(),
	costGasoline: numeric("cost_gasoline", { precision: 15, scale:  2 }).default('0'),
	costToll: numeric("cost_toll", { precision: 15, scale:  2 }).default('0'),
	costParking: numeric("cost_parking", { precision: 15, scale:  2 }).default('0'),
	costMeals: numeric("cost_meals", { precision: 15, scale:  2 }).default('0'),
	costMaintenance: numeric("cost_maintenance", { precision: 15, scale:  2 }).default('0'),
	costOthers: numeric("cost_others", { precision: 15, scale:  2 }).default('0'),
	createdBy: varchar("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	tripDestination: varchar("trip_destination", { length: 255 }),
	costRapidTest: numeric("cost_rapid_test", { precision: 15, scale:  2 }).default('0'),
	costFerry: numeric("cost_ferry", { precision: 15, scale:  2 }).default('0'),
	costPortal: numeric("cost_portal", { precision: 15, scale:  2 }).default('0'),
	costWashing: numeric("cost_washing", { precision: 15, scale:  2 }).default('0'),
	costEscort: numeric("cost_escort", { precision: 15, scale:  2 }).default('0'),
	costGasolineDexlite: numeric("cost_gasoline_dexlite", { precision: 15, scale:  2 }).default('0'),
	costGasolineBio: numeric("cost_gasoline_bio", { precision: 15, scale:  2 }).default('0'),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "fleet_trips_created_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.driverId],
			foreignColumns: [fleetDrivers.id],
			name: "fleet_trips_driver_id_fleet_drivers_id_fk"
		}),
	foreignKey({
			columns: [table.vehicleId],
			foreignColumns: [fleetVehicles.id],
			name: "fleet_trips_vehicle_id_fleet_vehicles_id_fk"
		}),
]);

export const fleetDrivers = pgTable("fleet_drivers", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const fleetVehicles = pgTable("fleet_vehicles", {
	id: serial().primaryKey().notNull(),
	policeNumber: varchar("police_number", { length: 50 }).notNull(),
	type: varchar({ length: 50 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const salesDocuments = pgTable("sales_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	fileUrl: text("file_url").notNull(),
	fileName: text("file_name").notNull(),
	fileType: text("file_type").notNull(),
	uploadedById: text("uploaded_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.uploadedById],
			foreignColumns: [user.id],
			name: "sales_documents_uploaded_by_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const salesOrders = pgTable("sales_orders", {
	id: serial().primaryKey().notNull(),
	invoiceNumber: varchar("invoice_number", { length: 50 }),
	customerPo: varchar("customer_po", { length: 100 }),
	customerId: integer("customer_id").notNull(),
	salesDate: timestamp("sales_date", { mode: 'string' }).defaultNow().notNull(),
	status: varchar({ length: 20 }).default('draft').notNull(),
	termsConditions: text("terms_conditions"),
	notes: text(),
	discount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	shipping: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	createdBy: varchar("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	warehouseId: integer("warehouse_id"),
	poReceive: timestamp("po_receive", { mode: 'string' }),
	categoryPo: varchar("category_po", { length: 50 }),
	categoryProduct: varchar("category_product", { length: 50 }),
	poDocument: varchar("po_document", { length: 255 }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "sales_orders_created_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_orders_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "sales_orders_warehouse_id_warehouses_id_fk"
		}),
	unique("sales_orders_invoice_number_unique").on(table.invoiceNumber),
]);

export const historyOrders = pgTable("history_orders", {
	id: serial().primaryKey().notNull(),
	sorg: text(),
	billTy: text("bill_ty"),
	revType: text("rev_type"),
	customer: text(),
	customerName: text("customer_name"),
	salesman: text(),
	item: text(),
	sloc: text(),
	plant: text(),
	materialNo: text("material_no"),
	materialDescription: text("material_description"),
	sizeDimen: text("size_dimen"),
	materialGroup: text("material_group"),
	matGrpDesc: text("mat_grp_desc"),
	matGrp1: text("mat_grp1"),
	matGrp1Desc: text("mat_grp1_desc"),
	matGrp2: text("mat_grp2"),
	matGrp2Desc: text("mat_grp2_desc"),
	matGrp3: text("mat_grp3"),
	matGrp3Desc: text("mat_grp3_desc"),
	matGrp4: text("mat_grp4"),
	matGrp4Desc: text("mat_grp4_desc"),
	matGrp5: text("mat_grp5"),
	matGrp5Desc: text("mat_grp5_desc"),
	qty: doublePrecision(),
	uom: text(),
	curr: text(),
	basePrice: doublePrecision("base_price"),
	intdeptPrice: doublePrecision("intdept_price"),
	adjustmentPrice: doublePrecision("adjustment_price"),
	revenueInDocCurr: doublePrecision("revenue_in_doc_curr"),
	revenueInLocCurr: doublePrecision("revenue_in_loc_curr"),
	billingNo: text("billing_no"),
	billingDate: text("billing_date"),
	inco1: text(),
	inco2: text(),
	c: text(),
	cancelled: text(),
	deliveryNo: text("delivery_no"),
	salesOrder: text("sales_order"),
	workOrder: text("work_order"),
	poNo: text("po_no"),
	poDate: text("po_date"),
	poType: text("po_type"),
	costOfSales: doublePrecision("cost_of_sales"),
	profitMargin: doublePrecision("profit_margin"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const competitorActivities = pgTable("competitor_activities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessConsultantId: text("business_consultant_id"),
	infoDate: timestamp("info_date", { mode: 'string' }).notNull(),
	competitorName: text("competitor_name").notNull(),
	customerName: text("customer_name").notNull(),
	industryCategory: text("industry_category").notNull(),
	location: text().notNull(),
	activityType: text("activity_type").notNull(),
	marketResponse: text("market_response").notNull(),
	businessImpact: text("business_impact").notNull(),
	description: text(),
	createdById: text("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.businessConsultantId],
			foreignColumns: [user.id],
			name: "competitor_activities_business_consultant_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "competitor_activities_created_by_id_user_id_fk"
		}),
]);

export const competitorPrices = pgTable("competitor_prices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	infoDate: timestamp("info_date", { mode: 'string' }).notNull(),
	businessConsultantId: text("business_consultant_id"),
	customerName: text("customer_name").notNull(),
	productSize: text("product_size").notNull(),
	category: text().notNull(),
	brand: text().notNull(),
	supplier: text().notNull(),
	currency: text().notNull(),
	price: text().notNull(),
	remark: text(),
	createdById: text("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	consultantName: text("consultant_name"),
}, (table) => [
	foreignKey({
			columns: [table.businessConsultantId],
			foreignColumns: [user.id],
			name: "competitor_prices_business_consultant_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "competitor_prices_created_by_id_user_id_fk"
		}),
]);

export const lostSales = pgTable("lost_sales", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	businessConsultantId: text("business_consultant_id"),
	productType: text("product_type").notNull(),
	offeringDate: timestamp("offering_date", { mode: 'string' }).notNull(),
	customerName: text("customer_name").notNull(),
	productDetail: text("product_detail").notNull(),
	totalOffering: text("total_offering").notNull(),
	reason: text().notNull(),
	remark: text(),
	createdById: text("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.businessConsultantId],
			foreignColumns: [user.id],
			name: "lost_sales_business_consultant_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "lost_sales_created_by_id_user_id_fk"
		}),
]);

export const portalItems = pgTable("portal_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	icon: varchar({ length: 100 }).default('Globe').notNull(),
	color: varchar({ length: 50 }).default('#3b82f6').notNull(),
	url: text().notNull(),
	newTab: boolean("new_tab").default(true).notNull(),
	category: varchar({ length: 100 }).default('General').notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const smtpSettings = pgTable("smtp_settings", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	host: varchar({ length: 255 }).default('smtp.gmail.com').notNull(),
	port: varchar({ length: 10 }).default('587').notNull(),
	secure: boolean().default(false).notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	fromEmail: varchar("from_email", { length: 255 }).notNull(),
	fromName: varchar("from_name", { length: 255 }).default('One Chitra').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	type: emailTemplateType().notNull(),
	subject: varchar({ length: 500 }).notNull(),
	htmlContent: text("html_content").notNull(),
	textContent: text("text_content"),
	variables: jsonb().default([]),
	recipientRoles: jsonb("recipient_roles").default([]),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	templateId: varchar("template_id", { length: 36 }),
	toEmail: varchar("to_email", { length: 255 }).notNull(),
	subject: varchar({ length: 500 }).notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	errorMessage: text("error_message"),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const evhsGiItems = pgTable("evhs_gi_items", {
	id: serial().primaryKey().notNull(),
	giRecordId: integer("gi_record_id").notNull(),
	materialNumber: varchar("material_number", { length: 100 }).notNull(),
	qty: numeric({ precision: 12, scale:  2 }).notNull(),
	price: numeric({ precision: 15, scale:  2 }),
	status: varchar({ length: 50 }),
});

export const stockOpnameItems = pgTable("stock_opname_items", {
	id: serial().primaryKey().notNull(),
	sessionId: integer("session_id").notNull(),
	productId: integer("product_id").notNull(),
	systemQty: integer("system_qty").default(0).notNull(),
	countedQty: integer("counted_qty"),
	variance: integer(),
	notes: text(),
	countedById: text("counted_by_id"),
	countedAt: timestamp("counted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.countedById],
			foreignColumns: [user.id],
			name: "stock_opname_items_counted_by_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_opname_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [stockOpnameSessions.id],
			name: "stock_opname_items_session_id_stock_opname_sessions_id_fk"
		}),
]);

export const stockMovements = pgTable("stock_movements", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id").notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	quantity: integer().notNull(),
	type: varchar({ length: 50 }).notNull(),
	referenceNumber: varchar("reference_number", { length: 100 }),
	recordedBy: text("recorded_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	customerId: integer("customer_id"),
	fromWarehouseId: integer("from_warehouse_id"),
	toWarehouseId: integer("to_warehouse_id"),
	notes: text(),
	source: varchar({ length: 50 }).default('OTHER').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_movements_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [user.id],
			name: "stock_movements_recorded_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_movements_warehouse_id_warehouses_id_fk"
		}),
]);

export const stockOpnameSessions = pgTable("stock_opname_sessions", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	status: stockOpnameStatus().default('open').notNull(),
	notes: text(),
	createdById: text("created_by_id"),
	closedById: text("closed_by_id"),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	opnameDate: timestamp("opname_date", { mode: 'string' }).notNull(),
	opnameTime: varchar("opname_time", { length: 10 }).notNull(),
	location: varchar({ length: 200 }).notNull(),
	documentUrl: varchar("document_url", { length: 500 }),
	documentTitle: varchar("document_title", { length: 200 }),
	documentFileName: varchar("document_file_name", { length: 200 }),
	documentFileType: varchar("document_file_type", { length: 100 }),
	documentFileSize: integer("document_file_size"),
	documentUploadedAt: timestamp("document_uploaded_at", { mode: 'string' }),
	documentUploadedBy: text("document_uploaded_by"),
}, (table) => [
	foreignKey({
			columns: [table.closedById],
			foreignColumns: [user.id],
			name: "stock_opname_sessions_closed_by_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "stock_opname_sessions_created_by_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.documentUploadedBy],
			foreignColumns: [user.id],
			name: "stock_opname_sessions_document_uploaded_by_user_id_fk"
		}),
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "stock_opname_sessions_warehouse_id_warehouses_id_fk"
		}),
]);

export const priceLists = pgTable("price_lists", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	type: priceListType().default('tier').notNull(),
	customerId: integer("customer_id"),
	currency: varchar({ length: 10 }).default('IDR').notNull(),
	validFrom: timestamp("valid_from", { mode: 'string' }).defaultNow().notNull(),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	notes: text(),
	createdById: text("created_by_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "price_lists_created_by_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "price_lists_customer_id_customers_id_fk"
		}),
]);

export const priceListItems = pgTable("price_list_items", {
	id: serial().primaryKey().notNull(),
	priceListId: integer("price_list_id").notNull(),
	productId: integer("product_id").notNull(),
	unitPrice: numeric("unit_price", { precision: 16, scale:  2 }).default('0').notNull(),
	minQty: integer("min_qty").default(1).notNull(),
	maxQty: integer("max_qty"),
	discountPct: numeric("discount_pct", { precision: 5, scale:  2 }).default('0').notNull(),
	marginFloor: numeric("margin_floor", { precision: 5, scale:  2 }).default('0').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.priceListId],
			foreignColumns: [priceLists.id],
			name: "price_list_items_price_list_id_price_lists_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "price_list_items_product_id_products_id_fk"
		}),
]);

export const priceHistory = pgTable("price_history", {
	id: serial().primaryKey().notNull(),
	priceListItemId: integer("price_list_item_id").notNull(),
	fieldChanged: varchar("field_changed", { length: 50 }).notNull(),
	oldValue: text("old_value"),
	newValue: text("new_value"),
	reason: text(),
	changedById: text("changed_by_id"),
	changedAt: timestamp("changed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.changedById],
			foreignColumns: [user.id],
			name: "price_history_changed_by_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.priceListItemId],
			foreignColumns: [priceListItems.id],
			name: "price_history_price_list_item_id_price_list_items_id_fk"
		}).onDelete("cascade"),
]);

export const evhsGiRecords = pgTable("evhs_gi_records", {
	id: serial().primaryKey().notNull(),
	source: varchar({ length: 20 }).default('upload').notNull(),
	filename: text(),
	periodDate: date("period_date"),
	warehouseId: integer("warehouse_id"),
	isMatched: boolean("is_matched").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const calendarEvents = pgTable("calendar_events", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	allDay: boolean("all_day").default(false).notNull(),
	type: calendarEventType().default('marketing').notNull(),
	color: varchar({ length: 20 }).default('#3b82f6'),
	relatedCustomerId: integer("related_customer_id"),
	emailReminderAt: timestamp("email_reminder_at", { withTimezone: true, mode: 'string' }),
	emailReminderSent: boolean("email_reminder_sent").default(false).notNull(),
	emailReminderTo: varchar("email_reminder_to", { length: 255 }),
	createdBy: varchar("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "calendar_events_created_by_user_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.relatedCustomerId],
			foreignColumns: [customers.id],
			name: "calendar_events_related_customer_id_customers_id_fk"
		}).onDelete("set null"),
]);

export const stockOpnameSignatures = pgTable("stock_opname_signatures", {
	id: serial().primaryKey().notNull(),
	sessionId: integer("session_id").notNull(),
	name: varchar({ length: 200 }).notNull(),
	position: varchar({ length: 200 }).notNull(),
	order: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const evhsMrko = pgTable("evhs_mrko", {
	id: serial().primaryKey().notNull(),
	mrkoNumber: varchar("mrko_number", { length: 100 }),
	releaseDate: timestamp("release_date", { mode: 'string' }),
	status: varchar({ length: 20 }).default('pending').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const forecasts = pgTable("forecasts", {
	id: serial().primaryKey().notNull(),
	period: text().notNull(),
	targetName: text("target_name").notNull(),
	targetType: text("target_type").notNull(),
	amount: doublePrecision().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isYearly: boolean("is_yearly").default(false).notNull(),
});

export const approvalDefinitions = pgTable("approval_definitions", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	formKey: varchar("form_key", { length: 100 }).notNull(),
	description: text(),
	version: integer().default(1).notNull(),
	status: approvalDefinitionStatus().default('draft').notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_definitions_form_key_idx").using("btree", table.formKey.asc().nullsLast().op("text_ops")),
	index("approval_definitions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "approval_definitions_created_by_user_id_fk"
		}),
	unique("approval_definitions_form_version_unique").on(table.formKey, table.version),
]);

export const approvalFormRegistry = pgTable("approval_form_registry", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	formKey: varchar("form_key", { length: 100 }).notNull(),
	formName: varchar("form_name", { length: 200 }).notNull(),
	modulePath: varchar("module_path", { length: 255 }).notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_form_registry_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "approval_form_registry_created_by_user_id_fk"
		}),
	unique("approval_form_registry_form_key_unique").on(table.formKey),
]);

export const approvalOrgStructures = pgTable("approval_org_structures", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	type: approvalOrgStructureType().default('enterprise').notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_org_structures_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("approval_org_structures_type_idx").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "approval_org_structures_created_by_user_id_fk"
		}),
]);

export const approvalOrgStructureNodes = pgTable("approval_org_structure_nodes", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	structureId: varchar("structure_id", { length: 36 }).notNull(),
	parentNodeId: varchar("parent_node_id", { length: 36 }),
	userId: text("user_id"),
	nodeName: varchar("node_name", { length: 200 }).notNull(),
	department: varchar({ length: 120 }),
	jobTitle: varchar("job_title", { length: 120 }),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_org_structure_nodes_parent_idx").using("btree", table.parentNodeId.asc().nullsLast().op("text_ops")),
	index("approval_org_structure_nodes_structure_idx").using("btree", table.structureId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "approval_org_structure_nodes_user_id_user_id_fk"
		}),
]);

export const approvalRequests = pgTable("approval_requests", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	definitionId: varchar("definition_id", { length: 36 }).notNull(),
	formKey: varchar("form_key", { length: 100 }).notNull(),
	entityId: varchar("entity_id", { length: 100 }).notNull(),
	requesterId: text("requester_id").notNull(),
	status: approvalRequestStatus().default('pending').notNull(),
	currentStepOrder: integer("current_step_order").default(1).notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow().notNull(),
	dueAt: timestamp("due_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	conditionSnapshot: jsonb("condition_snapshot").default({}),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_requests_form_entity_idx").using("btree", table.formKey.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("approval_requests_requester_idx").using("btree", table.requesterId.asc().nullsLast().op("text_ops")),
	index("approval_requests_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.definitionId],
			foreignColumns: [approvalDefinitions.id],
			name: "approval_requests_definition_id_approval_definitions_id_fk"
		}),
	foreignKey({
			columns: [table.requesterId],
			foreignColumns: [user.id],
			name: "approval_requests_requester_id_user_id_fk"
		}),
]);

export const approvalAssignments = pgTable("approval_assignments", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	requestId: varchar("request_id", { length: 36 }).notNull(),
	stepId: integer("step_id").notNull(),
	stepOrder: integer("step_order").notNull(),
	assigneeUserId: text("assignee_user_id").notNull(),
	status: approvalAssignmentStatus().default('pending').notNull(),
	actedAt: timestamp("acted_at", { mode: 'string' }),
	comment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_assignments_assignee_idx").using("btree", table.assigneeUserId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("approval_assignments_request_idx").using("btree", table.requestId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.assigneeUserId],
			foreignColumns: [user.id],
			name: "approval_assignments_assignee_user_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [approvalRequests.id],
			name: "approval_assignments_request_id_approval_requests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stepId],
			foreignColumns: [approvalDefinitionSteps.id],
			name: "approval_assignments_step_id_approval_definition_steps_id_fk"
		}),
]);

export const approvalAuditLogs = pgTable("approval_audit_logs", {
	id: serial().primaryKey().notNull(),
	requestId: varchar("request_id", { length: 36 }).notNull(),
	action: approvalDecisionAction().notNull(),
	actorUserId: text("actor_user_id"),
	payload: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_audit_request_idx").using("btree", table.requestId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [user.id],
			name: "approval_audit_logs_actor_user_id_user_id_fk"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [approvalRequests.id],
			name: "approval_audit_logs_request_id_approval_requests_id_fk"
		}).onDelete("cascade"),
]);

export const approvalMatrixImports = pgTable("approval_matrix_imports", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileType: varchar("file_type", { length: 20 }).notNull(),
	importedBy: text("imported_by"),
	status: varchar({ length: 30 }).default('success').notNull(),
	summary: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.importedBy],
			foreignColumns: [user.id],
			name: "approval_matrix_imports_imported_by_user_id_fk"
		}),
]);

export const deliveryCostRequestItems = pgTable("delivery_cost_request_items", {
	id: serial().primaryKey().notNull(),
	requestId: integer("request_id"),
	noPol: text("no_pol"),
	driverName: text("driver_name"),
	tripDestination: text("trip_destination"),
	fuelCost: numeric("fuel_cost", { precision: 20, scale:  2 }).default('0'),
	mealAllowance: numeric("meal_allowance", { precision: 20, scale:  2 }).default('0'),
	medicalTest: numeric("medical_test", { precision: 20, scale:  2 }).default('0'),
	tollRoad: numeric("toll_road", { precision: 20, scale:  2 }).default('0'),
	ferryCost: numeric("ferry_cost", { precision: 20, scale:  2 }).default('0'),
	portalCost: numeric("portal_cost", { precision: 20, scale:  2 }).default('0'),
	washGreaseCost: numeric("wash_grease_cost", { precision: 20, scale:  2 }).default('0'),
	escortCost: numeric("escort_cost", { precision: 20, scale:  2 }).default('0'),
	totalCost: numeric("total_cost", { precision: 20, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	deliveryId: integer("delivery_id"),
	fuelCostDexlite: numeric("fuel_cost_dexlite", { precision: 20, scale:  2 }).default('0'),
	fuelCostBio: numeric("fuel_cost_bio", { precision: 20, scale:  2 }).default('0'),
});

export const salesRevenueSap = pgTable("sales_revenue_sap", {
	salesRevId: integer("sales_rev_id"),
	sorg: text(),
	billTy: text("bill_ty"),
	revType: text("rev_type"),
	customer: text(),
	customerName: text("customer_name"),
	salesman: text(),
	item: integer(),
	sloc: text(),
	plant: text(),
	materialNo: text("material_no"),
	materialDescription: text("material_description"),
	sizeDimen: text("size_dimen"),
	materialGroup: text("material_group"),
	matGrpDesc: text("mat_grp_desc"),
	matGrp1: text("mat_grp1"),
	matGrp1Desc: text("mat_grp1_desc"),
	matGrp2: text("mat_grp2"),
	matGrp2Desc: text("mat_grp2_desc"),
	matGrp3: text("mat_grp3"),
	matGrp3Desc: text("mat_grp3_desc"),
	matGrp4: text("mat_grp4"),
	matGrp4Desc: text("mat_grp4_desc"),
	matGrp5: text("mat_grp5"),
	matGrp5Desc: text("mat_grp5_desc"),
	qty: integer(),
	uom: text(),
	curr: text(),
	basePrice: doublePrecision("base_price"),
	intdeptPrice: doublePrecision("intdept_price"),
	adjustmentPrice: doublePrecision("adjustment_price"),
	revenueInDocCurr: numeric("revenue_in_doc_curr", { precision: 20, scale:  2 }),
	revenueInLocCurr: numeric("revenue_in_loc_curr", { precision: 20, scale:  2 }),
	billingNo: text("billing_no"),
	billingDate: date("billing_date"),
	inco1: text(),
	inco2: text(),
	c: text(),
	cancelled: text(),
	deliveryNo: text("delivery_no"),
	salesOrder: text("sales_order"),
	workOrder: text("work_order"),
	poNo: text("po_no"),
	poDate: date("po_date"),
	poType: text("po_type"),
	costOfSales: doublePrecision("cost_of_sales"),
	profitMargin: doublePrecision("profit_margin"),
	extractedAt: timestamp("extracted_at", { mode: 'string' }),
});

export const customerAddresses = pgTable("customer_addresses", {
	id: serial().primaryKey().notNull(),
	customerId: integer("customer_id").notNull(),
	address: text().notNull(),
	label: varchar({ length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "customer_addresses_customer_id_customers_id_fk"
		}).onDelete("cascade"),
]);

export const deliveryCostRequests = pgTable("delivery_cost_requests", {
	id: serial().primaryKey().notNull(),
	requestDate: date("request_date").notNull(),
	accNo: text("acc_no"),
	bankName: text("bank_name"),
	accountName: text("account_name"),
	remarks: text(),
	requestBy: text("request_by"),
	knownBy1: text("known_by_1"),
	knownBy2: text("known_by_2"),
	approvedBy: text("approved_by"),
	receivedBy: text("received_by"),
	totalRequest: numeric("total_request", { precision: 20, scale:  2 }),
	totalTransfer: numeric("total_transfer", { precision: 20, scale:  2 }),
	totalBalance: numeric("total_balance", { precision: 20, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	status: text().default('Pengajuan').notNull(),
});

export const evhsReceiptItems = pgTable("evhs_receipt_items", {
	id: serial().primaryKey().notNull(),
	receiptId: integer("receipt_id").notNull(),
	productId: integer("product_id").notNull(),
	confirmedQty: integer("confirmed_qty").notNull(),
	serialNumbers: text("serial_numbers").array(),
});

export const evhsReceipts = pgTable("evhs_receipts", {
	id: serial().primaryKey().notNull(),
	transferId: integer("transfer_id").notNull(),
	receivedDate: timestamp("received_date", { mode: 'string' }).defaultNow().notNull(),
	doChitraNo: varchar("do_chitra_no", { length: 100 }),
	confirmedBy: varchar("confirmed_by"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const evhsVoucherItems = pgTable("evhs_voucher_items", {
	id: serial().primaryKey().notNull(),
	voucherId: integer("voucher_id").notNull(),
	productId: integer("product_id").notNull(),
	materialNumberCk: varchar("material_number_ck", { length: 100 }),
	qty: integer().notNull(),
	stockBalance: integer("stock_balance"),
	serialNumber: varchar("serial_number", { length: 100 }),
});

export const evhsVouchers = pgTable("evhs_vouchers", {
	id: serial().primaryKey().notNull(),
	vhsNo: varchar("vhs_no", { length: 100 }).notNull(),
	woNo: varchar("wo_no", { length: 100 }),
	date: date().notNull(),
	warehouseId: integer("warehouse_id").notNull(),
	remark: text(),
	issuedBy: varchar("issued_by"),
	approvedByName: varchar("approved_by_name", { length: 255 }),
	receivedByName: varchar("received_by_name", { length: 255 }),
	status: varchar({ length: 20 }).default('draft').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("evhs_vouchers_vhs_no_unique").on(table.vhsNo),
]);

export const campaignRecipients = pgTable("campaign_recipients", {
	id: serial().primaryKey().notNull(),
	campaignId: integer("campaign_id").notNull(),
	customerName: varchar("customer_name", { length: 255 }),
	email: varchar({ length: 255 }).notNull(),
	status: varchar({ length: 50 }).default('sent').notNull(),
	errorMessage: text("error_message"),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [marketingCampaigns.id],
			name: "campaign_recipients_campaign_id_marketing_campaigns_id_fk"
		}).onDelete("cascade"),
]);

export const rolePermissions = pgTable("role_permissions", {
	roleId: integer("role_id").notNull(),
	permissionId: integer("permission_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "role_permissions_role_id_roles_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.permissionId, table.roleId], name: "role_permissions_role_id_permission_id_pk"}),
]);
