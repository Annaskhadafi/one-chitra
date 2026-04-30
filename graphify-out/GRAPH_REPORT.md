# Graph Report - one-chitra  (2026-04-30)

## Corpus Check
- 1054 files · ~882,834 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4084 nodes · 5612 edges · 101 communities detected
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 1290 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 161|Community 161]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 180|Community 180]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]

## God Nodes (most connected - your core abstractions)
1. `getAuthenticatedSession()` - 226 edges
2. `String()` - 151 edges
3. `checkPermission()` - 40 edges
4. `sendSystemTemplatedEmailByCode()` - 28 edges
5. `ensureEmailManagementSchema()` - 27 edges
6. `safeRevalidatePath()` - 25 edges
7. `onSuccess()` - 25 edges
8. `getWarehouses()` - 23 edges
9. `getSafetyStockAnalytics()` - 20 edges
10. `Boolean()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `monthKey()` --calls--> `String()`  [INFERRED]
  app\actions\a2r-competition.ts → app\dashboard\deliveries\_components\delivery-table.tsx
- `importBillingRecords()` --calls--> `checkPermission()`  [INFERRED]
  app\actions\billing.ts → lib\rbac.ts
- `generateNextRefNumber()` --calls--> `String()`  [INFERRED]
  app\actions\cover-letter.ts → app\dashboard\deliveries\_components\delivery-table.tsx
- `saveDeliveryCostRequest()` --calls--> `String()`  [INFERRED]
  app\actions\delivery-cost-requests.ts → app\dashboard\deliveries\_components\delivery-table.tsx
- `updateDeliveryCostRequest()` --calls--> `String()`  [INFERRED]
  app\actions\delivery-cost-requests.ts → app\dashboard\deliveries\_components\delivery-table.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (184): AccountPage(), addWorkflowStep(), buildFormOptionFromRoute(), collectDashboardRoutes(), collectModuleFiles(), compareByOperator(), createApprovalDefinition(), createApprovalOrgNode() (+176 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (150): getAllSalesRevenueData(), getDashboardInventory(), getDashboardRevenueForecast(), getPct(), getRevenueReportConfig(), fetchAllSalesRevenueData(), fetchDashboardInventory(), fetchDashboardRevenueForecast() (+142 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (98): bulkDeleteDeliveries(), deleteDelivery(), updateDoMonitoringFields(), attachSalesDocumentsToQuotation(), buildComparableQuotationItems(), buildCustomerPoAttachmentTitle(), buildExtractedDataFromOcr(), buildMappedDataFromOcr() (+90 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (95): completeEvhsDraftVoucher(), confirmEvhsReceipt(), createEvhsDraftVoucher(), createEvhsVoucher(), createGiRecord(), deleteEvhsVoucher(), filterEvhsReceiptRowsByWarehouse(), formatEvhsWarehouseLabel() (+87 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (75): getFleetList(), acknowledgeNotification(), addDaysToDate(), addMonthsToDate(), average(), buildConfidenceNote(), buildMonthlySeries(), calculateLinearTrendSlope() (+67 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (71): getCustomers(), bulkDeleteMasterPrices(), createOrUpdateMasterPrice(), deleteMasterPrice(), getErrorMessage(), getEvhsMasterPrices(), importMasterPrices(), createProduct() (+63 more)

### Community 6 - "Community 6"
Cohesion: 0.02
Nodes (56): createCompetitorActivity(), createCompetitorPrice(), createLostSale(), getCompetitorActivities(), getCompetitorPrices(), getLostSales(), syncCompetitorPricesFromApi(), createCustomer() (+48 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (55): autoMatchCompetitorPrice(), calculateBundlingOptimization(), getBundlingFormDependencies(), getMaxHistoricalPrice(), createCosmeticTire(), deleteCosmeticTire(), ensureCosmeticTiresTable(), getCosmeticTires() (+47 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (59): getNavbarMenuSettingsAction(), resetNavbarMenuSettingsAction(), saveNavbarMenuSettingsAction(), getNavbarThemeAction(), isValidHexColor(), resetNavbarThemeAction(), revalidateNavbarThemePaths(), saveNavbarThemeAction() (+51 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (61): assertOriginWarehouseStock(), buildDeliveryItemQuantityMap(), buildDeliveryStockCheckResult(), bulkAttachDoScansByInternalNo(), bulkUpdateDeliveryStatus(), checkStockAvailability(), clearLogisticsCosts(), createDelivery() (+53 more)

### Community 10 - "Community 10"
Cohesion: 0.04
Nodes (55): createFleetTrip(), deleteFleetTrip(), generateTripNumber(), updateFleetTrip(), updateFleetTripStatus(), createSurveyForm(), createSurveyFormFromTemplate(), deleteSurveyForm() (+47 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (56): deriveCustomerSegments(), findBestCustomerMatch(), formatDateOnly(), getCustomerCampaignLaunchContext(), getCustomerMarketingInsight(), getCustomerOrderHistory(), getHistoryOrderForSegmentation(), getMarketingSegmentCustomerInsights() (+48 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (50): buildSalesOrderColumns(), bulkDeleteSalesOrders(), bulkUpdateSalesOrderStatus(), createSalesOrder(), deleteSalesOrder(), duplicateCustomerPoResult(), findExistingSalesOrderByCustomerPo(), generateInvoiceNumber() (+42 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (66): getSettlementById(), extractInternalNo(), forceDeliveryYear2026(), getErrorMessage(), hasMeaningfulBasicResult(), normalizeInternalNo(), sanitizeText(), selectDisplayText() (+58 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (39): buildStockOpnameActualEmailContent(), bulkDeleteStockOpnameSessions(), bulkUpdateOpnameCounts(), cancelStockOpnameSession(), closeStockOpnameSession(), createStockOpnameActualSession(), createStockOpnameSession(), deleteStockOpnameSession() (+31 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (31): bulkDeleteRepairMasterItems(), cleanText(), deleteRepairMasterItem(), deleteRepairMasterSite(), ensureDefaultRepairSites(), ensureRepairMasterTables(), getRepairMasterData(), upsertRepairMasterItem() (+23 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (27): batchSyncInvoiceFromBilling(), deleteBillingRecord(), getBillingRecordByPo(), getBillingRecords(), getFirstExecuteRow(), getInvoiceInfoByDoSap(), getInvoiceInfoByPoNo(), importBillingRecords() (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (33): buildGoodReceiveManualNotificationContent(), buildLatestPoItemMap(), buildVendorFallbackMap(), createGoodReceiveManual(), escapeHtml(), findEprRecipientByPoNumber(), getFirstStringValue(), getGoodReceiveManualById() (+25 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (38): assertMembership(), createGroupRoom(), deleteChatRoom(), deleteMessage(), deleteUserSticker(), editMessage(), enrichMessages(), generateHelpDeskReplyForRoom() (+30 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (37): extractInternalNo(), forceDeliveryYear2026(), normalizeInternalNo(), POST(), sanitizeText(), selectDisplayText(), extractJsonFromText(), sanitizeOcrText() (+29 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (30): askHelpDeskOllama(), buildKnowledgeDraftFromDocument(), deleteHelpDeskKnowledgeSource(), ensureBotUser(), ensureHelpDeskKnowledgeSeed(), ensureHelpDeskRoom(), extractHelpDeskKnowledgeFromDocument(), generateHelpDeskReply() (+22 more)

### Community 21 - "Community 21"
Cohesion: 0.1
Nodes (32): getMLFilters(), getRevenueMLForecast(), fetchForecast(), handleRefresh(), addMonths(), average(), buildAnomalies(), buildConfidence() (+24 more)

### Community 22 - "Community 22"
Cohesion: 0.06
Nodes (17): buildContextQuickActions(), buildFollowupQuickActions(), getAttachmentUrl(), getChatAvatarSrc(), getHelpDeskPageContext(), isGifAttachment(), isVisualAttachment(), AutoCloseSidebar() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (20): createCalendarEvent(), getCalendarEvents(), getCustomerListForBirthday(), getCustomersWithTomorrowBirthday(), getPendingEmailReminders(), importCustomerBirthdays(), markReminderSent(), updateCalendarEvent() (+12 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (21): bulkUpdateDeliveryShipmentDetails(), checkTransferStockAvailability(), createStockTransfer(), getStockTransfers(), getStockTransferStats(), mergeTransferItemsByProduct(), syncStockTransferReceipt(), updateStockTransfer() (+13 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (22): getStockCardCatalogAction(), getStockCardDetailAction(), getStockCardLabelsByIdsAction(), getCanonicalAppUrl(), stripTrailingSlash(), toCanonicalAppUrl(), normalizeUrl(), resolveBaseURL() (+14 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (10): handleDownloadPdf(), buildQuotationPdfPayload(), downloadBlob(), formatCurrency(), formatDate(), generateQuotationPdf(), getLetterheadDataUrl(), inferMimeType() (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (20): buildStandardPrintHtml(), buildVoucherHtml(), chunkVouchers(), compareVoucherByPos(), escapeHtml(), EvhsVoucherPreview(), formatVoucherDate(), getPosSortMeta() (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (25): A2RCompetitionPage(), getDefaultYear(), buildMonthlyScore(), buildSelectedMonths(), ensureA2RSalesTargetsTable(), getA2RCompetitionData(), getA2RCompetitionFilterOptions(), getA2RCompetitionTargetSetup() (+17 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (18): deleteInventoryVendorProfile(), ensureInventoryVendorTables(), getDateDifferenceInDays(), getInventoryVendorProfiles(), getMaterialVendorReference(), normalizeMaterialNo(), normalizeVendorName(), parseDateValue() (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (21): buildDataUri(), extractJsonFromText(), extractRawTextFromDocument(), extractStructuredFromDocument(), getBboxAnnotationInput(), getDocumentAnnotationInput(), getRawText(), normalizeDocumentForOcr() (+13 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (19): createSettlement(), deleteSettlement(), generateSettlementNumber(), getLatestSettlementByDeliveryIds(), getLatestSettlementByFleetTripIds(), getSettlements(), getSettlementSession(), getSettlementSummary() (+11 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (22): addMonths(), addPeriods(), average(), buildAutoArimaForecastValues(), buildForecastValues(), formatPeriodLabel(), getFuturePeriods(), getProcurementNextAnalytics() (+14 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (7): buildPayload(), handleFileImport(), inferMapping(), openEditDialog(), parseNullableInt(), parseNumber(), toFormState()

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (8): getApprovalReport(), getCustomerReport(), getMonthlyScmReport(), getSalesReport(), ApprovalReportPage(), CustomerReportPage(), SalesReportPage(), ScmMonthlyReportPage()

### Community 35 - "Community 35"
Cohesion: 0.2
Nodes (14): formatDate(), formatMinutes(), formatMonthKey(), formatNumber(), getDetailLookupKeys(), getHeaderDetailLookupKey(), hasActualWorkOrder(), isEmptyWorkOrder() (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (8): getDeliveryCostRequestStats(), getFleetData(), getSavedDeliveryCostRequests(), getUnsettledDeliveryCosts(), saveDeliveryCostRequest(), updateDeliveryCostRequest(), fetchUnsettled(), DeliveryCostRequestPage()

### Community 37 - "Community 37"
Cohesion: 0.24
Nodes (15): buildWipRepairSapCopyText(), cleanText(), convertQuantityToMasterUom(), formatSapQuantity(), getLookupTokens(), getMaterialNameTokens(), isValidMaterialNumber(), makeMasterMaterialLookup() (+7 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (5): getTodayStr(), handleEdit(), handleNewLetter(), handleViewSaved(), resetForm()

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (6): buildSalesDashboardWhere(), getSalesDashboardData(), getSalesDashboardDynamicFilters(), getSalesDashboardFilters(), fetchDynamicFilters(), SalesDashboardPage()

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (7): formatCurrency(), formatDate(), getPendingQuotationAttachments(), getQuotationUrls(), handleAutoOcrPending(), runOcrBatch(), toggleEntrySelection()

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (12): getOcrStatusMap(), getVendorQuotationById(), mapToSerializable(), normalizeNullableText(), saveVendorQuotationDraft(), syncVendorQuotationsFromEpr(), buildLatestGrManualByPo(), EprIntegrasiPage() (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (6): DashboardThemeProvider(), useTheme(), SimpleThemeToggle(), ThemeToggle(), useMounted(), Toaster()

### Community 43 - "Community 43"
Cohesion: 0.12
Nodes (4): getSalesHistory(), handleGenerate(), calculateMovingAverage(), test()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (11): findHeader(), getStringValue(), handleDialogOpenChange(), handleFileSelect(), handleImport(), normalizeHeader(), parseDateValue(), parseGiFile() (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.18
Nodes (4): addSubItem(), removeCustomSubItem(), updateItem(), updateSubItem()

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (9): async(), navigateToNotificationTarget(), registerNotificationServiceWorker(), getQueryClient(), makeQueryClient(), Providers(), syncServiceWorkerRegistration(), isServiceWorkerEnabled() (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.27
Nodes (12): buildContent(), buildSlug(), buildSummary(), buildTags(), buildTitle(), describeRouteType(), getActorUserId(), main() (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.24
Nodes (10): buildPayload(), deleteLogisticsMasterPrice(), getLogisticsMasterPrices(), importLogisticsMasterPrices(), isMissingTableError(), normalizeNullableNumber(), normalizeNullableString(), upsertLogisticsMasterPrice() (+2 more)

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (5): generateNextRefNumber(), getCustomersForCoverLetter(), getSavedCoverLetters(), getSigners(), CoverLetterPage()

### Community 50 - "Community 50"
Cohesion: 0.23
Nodes (9): handleSelect(), applySelectedFiles(), createProgressTicker(), delay(), easeProgress(), hasMeaningfulBasicResult(), onDrop(), onSelect() (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (6): fetchGoodReceiveFromSAP(), processGoodReceive(), handleProcess(), main(), main(), main()

### Community 52 - "Community 52"
Cohesion: 0.2
Nodes (6): handleDecision(), validateComment(), canRevert(), hasAnyApproverDecision(), validateNotePolicy(), validateStepReorder()

### Community 53 - "Community 53"
Cohesion: 0.2
Nodes (6): createNodeMachineDefinition(), createStandardNodeDefinition(), validateNodeMachineDefinition(), appendHistory(), nowIso(), validateApprovalMachineConfig()

### Community 54 - "Community 54"
Cohesion: 0.35
Nodes (11): addBase(), addCard(), addLayer(), addMetricCard(), addPill(), addProcessStep(), addRecommendation(), addTextBox() (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (3): handleToggleMonth(), handleYearChange(), refreshData()

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (6): buildPrintHtml(), createInitialFormState(), escapeHtml(), formatDate(), handlePrint(), todayValue()

### Community 57 - "Community 57"
Cohesion: 0.2
Nodes (1): escapeCsvValue()

### Community 59 - "Community 59"
Cohesion: 0.39
Nodes (7): buildCustomerCandidates(), callMistralChatCompletion(), getMessageContent(), parseJsonContent(), POST(), sanitizeText(), tryAiMapping()

### Community 60 - "Community 60"
Cohesion: 0.39
Nodes (7): compareNumber(), compareText(), EvhsAllVhsStockTable(), getCategoryPriority(), getStatusLabel(), getWarehouseLabel(), sortRows()

### Community 61 - "Community 61"
Cohesion: 0.53
Nodes (7): fetchPlatformData(), handleDelete(), handleImport(), handleSubmit(), isMissingServerActionError(), loadData(), runServerAction()

### Community 62 - "Community 62"
Cohesion: 0.31
Nodes (4): buildItemMap(), formatCurrency(), getChanges(), getItemTotal()

### Community 63 - "Community 63"
Cohesion: 0.56
Nodes (7): getDetailGroupingKeys(), getDetailLookupKeys(), getNormalizedText(), getWorkOrderDetailKey(), isWaitingWorkOrder(), normalizeTireSn(), normalizeValue()

### Community 64 - "Community 64"
Cohesion: 0.31
Nodes (6): escapeHtml(), insertLink(), normalizeHtmlForEditor(), runCommand(), syncParallelApproverNames(), update()

### Community 65 - "Community 65"
Cohesion: 0.31
Nodes (5): buildInitialGraph(), buildMachineConfig(), getSortedApprovalNodes(), makeEdge(), WorkflowCanvas()

### Community 66 - "Community 66"
Cohesion: 0.25
Nodes (4): handleFileSelect(), downloadCSVTemplate(), generateCSVTemplate(), parseAndValidateCSV()

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (6): mapOcrItemsToProductIds(), callMistralChatCompletion(), getMessageContent(), mapCustomerNameToId(), parseJsonContent(), POST()

### Community 68 - "Community 68"
Cohesion: 0.44
Nodes (8): ensureApprovalSection(), getApprovalResourceByUrl(), main(), makeApprovalGroupItem(), makeItemId(), makeSectionId(), makeSubItem(), removeFromAdmin()

### Community 69 - "Community 69"
Cohesion: 0.32
Nodes (3): buildConfig(), handleSubmit(), validate()

### Community 70 - "Community 70"
Cohesion: 0.33
Nodes (2): handleSave(), validateDraft()

### Community 78 - "Community 78"
Cohesion: 0.62
Nodes (6): createDefinition(), ensureFormRegistry(), ensureUser(), main(), runConditionBranchingTest(), runParallelExplicitAssigneeTest()

### Community 81 - "Community 81"
Cohesion: 0.4
Nodes (2): getDefaultFilters(), loadFiltersFromStorage()

### Community 82 - "Community 82"
Cohesion: 0.47
Nodes (3): extractRationaleJson(), isValidMLReportData(), stripCodeFence()

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (1): formatDateCell()

### Community 85 - "Community 85"
Cohesion: 0.53
Nodes (4): calculateGrandTotal(), calculateSubtotal(), calculateTotalDiscount(), calculateTotalTax()

### Community 86 - "Community 86"
Cohesion: 0.4
Nodes (2): calculatePrice(), calculateValuation()

### Community 90 - "Community 90"
Cohesion: 0.4
Nodes (2): toggleCheckbox(), updateAnswer()

### Community 92 - "Community 92"
Cohesion: 0.53
Nodes (4): filterKanbanItems(), getDeadlineBucket(), getGroupKey(), toTimeValue()

### Community 94 - "Community 94"
Cohesion: 0.4
Nodes (2): getR49DashboardFilters(), R49DashboardPage()

### Community 95 - "Community 95"
Cohesion: 0.4
Nodes (2): getSerialNumberHistory(), SerialNumberContent()

### Community 96 - "Community 96"
Cohesion: 0.4
Nodes (2): handleDelete(), onDelete()

### Community 99 - "Community 99"
Cohesion: 0.5
Nodes (2): buildPrintHTML(), formatDateLong()

### Community 100 - "Community 100"
Cohesion: 0.6
Nodes (3): addEmail(), handleKeyDown(), isValidEmail()

### Community 102 - "Community 102"
Cohesion: 0.6
Nodes (3): CustomLabel(), formatRevenueNumber(), renderLabel()

### Community 103 - "Community 103"
Cohesion: 0.4
Nodes (2): PermissionGuard(), usePermissions()

### Community 104 - "Community 104"
Cohesion: 0.7
Nodes (4): hasYearToken(), isVendorQuotationFrom2026(), isVendorQuotationFromYear(), tryExtractYearFromDate()

### Community 105 - "Community 105"
Cohesion: 0.6
Nodes (3): compactBrand(), getFuzzyBrandMatch(), normalizeWipRepairBrand()

### Community 107 - "Community 107"
Cohesion: 0.83
Nodes (3): sessionDataArbitrary(), signatureArbitrary(), timeStringArbitrary()

### Community 108 - "Community 108"
Cohesion: 0.83
Nodes (3): GET(), loadNotificationDeps(), POST()

### Community 112 - "Community 112"
Cohesion: 0.83
Nodes (3): getGroupedMatchingStocks(), getMatchingStocks(), normalizeTireSize()

### Community 135 - "Community 135"
Cohesion: 0.83
Nodes (3): getInvoiceInfoByPoNo(), main(), simulateBatchSync()

### Community 137 - "Community 137"
Cohesion: 1.0
Nodes (2): isPublicRoute(), proxy()

### Community 138 - "Community 138"
Cohesion: 1.0
Nodes (2): getABCAnalysis(), getABCSummary()

### Community 141 - "Community 141"
Cohesion: 1.0
Nodes (2): getDashboardStats(), getRangeBounds()

### Community 145 - "Community 145"
Cohesion: 0.67
Nodes (1): PrintLayout()

### Community 161 - "Community 161"
Cohesion: 0.67
Nodes (1): PrintChecklistLayout()

### Community 178 - "Community 178"
Cohesion: 1.0
Nodes (2): main(), splitSqlStatements()

### Community 179 - "Community 179"
Cohesion: 1.0
Nodes (2): main(), splitSqlStatements()

### Community 180 - "Community 180"
Cohesion: 1.0
Nodes (2): ensureMigrationTable(), main()

### Community 181 - "Community 181"
Cohesion: 1.0
Nodes (2): main(), normalizedTextSql()

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (2): loadRepairCandidates(), main()

## Knowledge Gaps
- **Thin community `Community 57`** (10 nodes): `do-monitoring-table.tsx`, `calculateGrandTotal()`, `escapeCsvValue()`, `formatCurrency()`, `formatQuantity()`, `getDateRangePreset()`, `getDeliveryItemValue()`, `getMatchedDeliveryItems()`, `getWarehouseLabel()`, `if()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (7 nodes): `matrix-builder.tsx`, `addDraftNode()`, `handleSave()`, `makeTempId()`, `removeDraftNode()`, `updateDraftNode()`, `validateDraft()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (6 nodes): `filter-context.tsx`, `FilterProvider()`, `getDefaultFilters()`, `loadFiltersFromStorage()`, `saveFiltersToStorage()`, `useFilters()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (6 nodes): `sales-revenue-table.tsx`, `fmt()`, `formatDateCell()`, `handleExportExcel()`, `toggleCustomerName()`, `toggleSalesman()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (6 nodes): `stock-table.tsx`, `calculatePrice()`, `calculateValuation()`, `formatCurrency()`, `getBookingRemarkSummary()`, `getTotalBookingQty()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (6 nodes): `form-renderer.tsx`, `cn()`, `handleSubmit()`, `handleUploadAnswerFile()`, `toggleCheckbox()`, `updateAnswer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (5 nodes): `getR49DashboardData()`, `getR49DashboardFilters()`, `r49-dashboard.ts`, `page.tsx`, `R49DashboardPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (5 nodes): `getSerialNumberHistory()`, `serial-number.ts`, `page.tsx`, `SerialNumberContent()`, `SerialNumberHistoryPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (5 nodes): `event-detail-sheet.tsx`, `vendor-quotation-table.tsx`, `handleDelete()`, `formatCurrency()`, `onDelete()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (5 nodes): `cover-letter-dialog.tsx`, `buildPrintHTML()`, `CoverLetterDialog()`, `formatDate()`, `formatDateLong()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (5 nodes): `PermissionGuard()`, `permission-guard.tsx`, `PermissionsProvider()`, `use-permissions.tsx`, `usePermissions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 137`** (3 nodes): `isPublicRoute()`, `proxy()`, `proxy.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 138`** (3 nodes): `getABCAnalysis()`, `getABCSummary()`, `abc-analysis.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (3 nodes): `getDashboardStats()`, `getRangeBounds()`, `dashboard.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (3 nodes): `layout.tsx`, `layout.tsx`, `PrintLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 161`** (3 nodes): `layout.tsx`, `layout.tsx`, `PrintChecklistLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 178`** (3 nodes): `main()`, `splitSqlStatements()`, `apply-approval-migration.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 179`** (3 nodes): `main()`, `splitSqlStatements()`, `apply-approval-org-migration.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 180`** (3 nodes): `ensureMigrationTable()`, `main()`, `baseline-migrations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 181`** (3 nodes): `main()`, `normalizedTextSql()`, `fix-stock-product-sloc-mismatch.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (3 nodes): `loadRepairCandidates()`, `main()`, `repair-delivery-qty-anomalies.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getAuthenticatedSession()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 21`, `Community 24`, `Community 25`, `Community 28`, `Community 29`, `Community 31`, `Community 43`, `Community 48`, `Community 51`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Why does `String()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 40`, `Community 41`, `Community 44`, `Community 49`, `Community 54`, `Community 57`, `Community 59`, `Community 61`, `Community 84`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Why does `checkPermission()` connect `Community 10` to `Community 0`, `Community 2`, `Community 9`, `Community 12`, `Community 16`, `Community 24`, `Community 31`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 223 inferred relationships involving `getAuthenticatedSession()` (e.g. with `getA2RCompetitionFilterOptions()` and `getA2RCompetitionTargetSetup()`) actually correct?**
  _`getAuthenticatedSession()` has 223 INFERRED edges - model-reasoned connections that need verification._
- **Are the 149 inferred relationships involving `String()` (e.g. with `monthKey()` and `normalizeText()`) actually correct?**
  _`String()` has 149 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `checkPermission()` (e.g. with `getApprovalRequestDetail()` and `batchSyncInvoiceFromBilling()`) actually correct?**
  _`checkPermission()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `sendSystemTemplatedEmailByCode()` (e.g. with `createAssignmentsForStep()` and `runApprovalSlaEscalationJob()`) actually correct?**
  _`sendSystemTemplatedEmailByCode()` has 16 INFERRED edges - model-reasoned connections that need verification._