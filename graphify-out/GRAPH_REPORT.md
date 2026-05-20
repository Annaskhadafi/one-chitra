# Graph Report - one-chitra  (2026-05-20)

## Corpus Check
- 1115 files · ~978,209 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4408 nodes · 6049 edges · 100 communities detected
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1358 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 93|Community 93]]
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
- [[_COMMUNITY_Community 162|Community 162]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 180|Community 180]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]

## God Nodes (most connected - your core abstractions)
1. `getAuthenticatedSession()` - 236 edges
2. `String()` - 165 edges
3. `checkPermission()` - 40 edges
4. `sendSystemTemplatedEmailByCode()` - 28 edges
5. `ensureEmailManagementSchema()` - 27 edges
6. `safeRevalidatePath()` - 25 edges
7. `onSuccess()` - 25 edges
8. `getWarehouses()` - 23 edges
9. `Boolean()` - 21 edges
10. `getSafetyStockAnalytics()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `monthKey()` --calls--> `String()`  [INFERRED]
  app\actions\a2r-competition.ts → app\dashboard\deliveries\_components\delivery-table.tsx
- `getSubWorkflowOptions()` --calls--> `getAuthenticatedSession()`  [INFERRED]
  app\actions\approval.ts → lib\rbac.ts
- `getApprovalRequestsByDefinition()` --calls--> `getAuthenticatedSession()`  [INFERRED]
  app\actions\approval.ts → lib\rbac.ts
- `getApprovalMatrixImports()` --calls--> `getAuthenticatedSession()`  [INFERRED]
  app\actions\approval.ts → lib\rbac.ts
- `getApprovalOrgUsers()` --calls--> `getAuthenticatedSession()`  [INFERRED]
  app\actions\approval.ts → lib\rbac.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (217): AccountPage(), createCosmeticTire(), deleteCosmeticTire(), ensureCosmeticTiresTable(), getCosmeticTires(), importCosmeticTires(), normalizeInput(), updateCosmeticTire() (+209 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (142): getCustomers(), completeEvhsDraftVoucher(), confirmEvhsReceipt(), createEvhsDraftVoucher(), createEvhsVoucher(), createGiRecord(), filterEvhsReceiptRowsByWarehouse(), formatEvhsVoucherDateInput() (+134 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (140): addWorkflowStep(), buildFormOptionFromRoute(), collectDashboardRoutes(), collectModuleFiles(), compareByOperator(), createApprovalDefinition(), createApprovalOrgNode(), createApprovalOrgStructure() (+132 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (141): getAllSalesRevenueData(), getDashboardInventory(), getDashboardRevenueForecast(), getPct(), getRevenueReportConfig(), fetchAllSalesRevenueData(), fetchDashboardInventory(), fetchDashboardRevenueForecast() (+133 more)

### Community 4 - "Community 4"
Cohesion: 0.01
Nodes (90): batchSyncInvoiceFromBilling(), deleteBillingRecord(), getBillingRecordByPo(), getBillingRecords(), getFirstExecuteRow(), getInvoiceInfoByDoSap(), getInvoiceInfoByPoNo(), importBillingRecords() (+82 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (82): bulkDeleteDeliveries(), deleteDelivery(), updateDoMonitoringFields(), attachSalesDocumentsToQuotation(), buildComparableQuotationItems(), buildCustomerPoAttachmentTitle(), buildExtractedDataFromOcr(), buildMappedDataFromOcr() (+74 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (72): assertOriginWarehouseStock(), buildDeliveryItemQuantityMap(), buildDeliveryStockCheckResult(), bulkAttachDoScansByInternalNo(), bulkUpdateDeliveryStatus(), checkStockAvailability(), clearLogisticsCosts(), createDelivery() (+64 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (54): getApprovalRequestDetail(), createFleetTrip(), deleteFleetTrip(), generateTripNumber(), updateFleetTrip(), updateFleetTripStatus(), createSurveyForm(), createSurveyFormFromTemplate() (+46 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (64): extractInternalNo(), forceDeliveryYear2026(), getErrorMessage(), hasMeaningfulBasicResult(), normalizeInternalNo(), sanitizeText(), selectDisplayText(), toBasicPayload() (+56 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (43): csvUrl(), fetchSheet(), getField(), loadSheet(), parseActivity(), parseDateValue(), parseLostSale(), parseMoney() (+35 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (56): buildSalesOrderColumns(), bulkDeleteSalesOrders(), bulkUpdateSalesOrderStatus(), createSalesOrder(), deleteSalesOrder(), duplicateCustomerPoResult(), findExistingSalesOrderByCustomerPo(), generateInvoiceNumber() (+48 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (53): getNavbarMenuSettingsAction(), resetNavbarMenuSettingsAction(), saveNavbarMenuSettingsAction(), getNavbarThemeAction(), isValidHexColor(), resetNavbarThemeAction(), revalidateNavbarThemePaths(), saveNavbarThemeAction() (+45 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (38): bulkDeleteRepairMasterItems(), cleanText(), deleteRepairMasterItem(), deleteRepairMasterSite(), ensureDefaultRepairSites(), ensureRepairMasterTables(), getRepairMasterData(), upsertRepairMasterItem() (+30 more)

### Community 13 - "Community 13"
Cohesion: 0.04
Nodes (31): autoMatchCompetitorPrice(), calculateBundlingOptimization(), getBundlingFormDependencies(), getMaxHistoricalPrice(), getHistoryOrder(), getProductHistoryForQuotation(), getRealtimeExchangeRate(), getSetting() (+23 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (39): buildStockOpnameActualEmailContent(), bulkDeleteStockOpnameSessions(), bulkUpdateOpnameCounts(), cancelStockOpnameSession(), closeStockOpnameSession(), createStockOpnameActualSession(), createStockOpnameSession(), deleteStockOpnameSession() (+31 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (34): getLatestSafetyStockPredictionByMaterial(), getMaterialSalesRevenueHistory(), deleteInventoryVendorProfile(), ensureInventoryVendorTables(), getDateDifferenceInDays(), getInventoryVendorProfiles(), getMaterialVendorReference(), normalizeMaterialNo() (+26 more)

### Community 16 - "Community 16"
Cohesion: 0.05
Nodes (30): duplicateQuotation(), syncSavedDelivery(), addSearchSelection(), clearRefreshParams(), compactSearchText(), downloadCsvFile(), downloadExcelFile(), escapeCsvValue() (+22 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (41): extractInternalNo(), forceDeliveryYear2026(), normalizeInternalNo(), POST(), sanitizeText(), selectDisplayText(), extractJsonFromText(), sanitizeOcrText() (+33 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (33): buildGoodReceiveManualNotificationContent(), buildLatestPoItemMap(), buildVendorFallbackMap(), createGoodReceiveManual(), escapeHtml(), findEprRecipientByPoNumber(), getFirstStringValue(), getGoodReceiveManualById() (+25 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (38): assertMembership(), createGroupRoom(), deleteChatRoom(), deleteMessage(), deleteUserSticker(), editMessage(), enrichMessages(), generateHelpDeskReplyForRoom() (+30 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (29): deriveCustomerSegments(), findBestCustomerMatch(), formatDateOnly(), getCustomerCampaignLaunchContext(), getCustomerMarketingInsight(), getCustomerOrderHistory(), getHistoryOrderForSegmentation(), getMarketingSegmentCustomerInsights() (+21 more)

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
Cohesion: 0.07
Nodes (11): handleDownloadPdf(), buildQuotationPdfPayload(), downloadBlob(), formatCurrency(), formatDate(), generateQuotationPdf(), getLetterheadDataUrl(), inferMimeType() (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (21): bulkUpdateDeliveryShipmentDetails(), checkTransferStockAvailability(), createStockTransfer(), getStockTransfers(), getStockTransferStats(), mergeTransferItemsByProduct(), syncStockTransferReceipt(), updateStockTransfer() (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (22): getStockCardCatalogAction(), getStockCardDetailAction(), getStockCardLabelsByIdsAction(), getCanonicalAppUrl(), stripTrailingSlash(), toCanonicalAppUrl(), normalizeUrl(), resolveBaseURL() (+14 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (29): askHelpDeskOllama(), buildKnowledgeDraftFromDocument(), deleteHelpDeskKnowledgeSource(), ensureBotUser(), ensureHelpDeskKnowledgeSeed(), ensureHelpDeskRoom(), extractHelpDeskKnowledgeFromDocument(), generateHelpDeskReply() (+21 more)

### Community 28 - "Community 28"
Cohesion: 0.1
Nodes (22): deleteEvhsVoucher(), buildStandardPrintHtml(), buildVoucherHtml(), chunkVouchers(), compareVoucherByPos(), escapeHtml(), EvhsVoucherPreview(), formatVoucherDate() (+14 more)

### Community 29 - "Community 29"
Cohesion: 0.1
Nodes (20): emptyForm(), getFormInitialValue(), handleImport(), handleOpenChange(), handleSaved(), resetImport(), rowToTypedRecord(), uniqueManufactureOptions() (+12 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (18): deleteDeliveryCostCredit(), ensureDeliveryCostCreditTable(), ensureDeliveryCostRealizationColumns(), getDeliveryCostCredits(), getDeliveryCostRequestStats(), getFleetData(), getSavedDeliveryCostRequests(), getUnsettledDeliveryCosts() (+10 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (21): createSettlement(), deleteSettlement(), generateSettlementNumber(), getLatestSettlementByDeliveryIds(), getLatestSettlementByFleetTripIds(), getSettlementById(), getSettlements(), getSettlementSession() (+13 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (26): A2RCompetitionPage(), getDefaultYear(), buildMonthlyScore(), buildSelectedMonths(), ensureA2RSalesTargetsTable(), getA2RCompetitionData(), getA2RCompetitionFilterOptions(), getA2RCompetitionTargetSetup() (+18 more)

### Community 33 - "Community 33"
Cohesion: 0.09
Nodes (12): cleanText(), getDatePresetRange(), parseActivityRows(), parseDateValue(), toDateInputValue(), cleanText(), getDatePresetRange(), handleDatePresetChange() (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (22): addMonths(), addPeriods(), average(), buildAutoArimaForecastValues(), buildForecastValues(), formatPeriodLabel(), getFuturePeriods(), getProcurementNextAnalytics() (+14 more)

### Community 35 - "Community 35"
Cohesion: 0.17
Nodes (20): buildEnhancedPrompt(), collectCandidates(), extractProviderError(), generateOneImage(), loadPublicImageReference(), loadWearpackReferences(), normalizeReferenceAssets(), parseImageCandidates() (+12 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (17): buildDataUri(), extractJsonFromText(), extractRawTextFromDocument(), extractStructuredFromDocument(), getBboxAnnotationInput(), getDocumentAnnotationInput(), getRawText(), normalizeDocumentForOcr() (+9 more)

### Community 37 - "Community 37"
Cohesion: 0.13
Nodes (7): buildPayload(), handleFileImport(), inferMapping(), openEditDialog(), parseNullableInt(), parseNumber(), toFormState()

### Community 38 - "Community 38"
Cohesion: 0.11
Nodes (8): getApprovalReport(), getCustomerReport(), getMonthlyScmReport(), getSalesReport(), ApprovalReportPage(), CustomerReportPage(), SalesReportPage(), ScmMonthlyReportPage()

### Community 39 - "Community 39"
Cohesion: 0.2
Nodes (14): formatDate(), formatMinutes(), formatMonthKey(), formatNumber(), getDetailLookupKeys(), getHeaderDetailLookupKey(), hasActualWorkOrder(), isEmptyWorkOrder() (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (5): getTodayStr(), handleEdit(), handleNewLetter(), handleViewSaved(), resetForm()

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (6): buildSalesDashboardWhere(), getSalesDashboardData(), getSalesDashboardDynamicFilters(), getSalesDashboardFilters(), fetchDynamicFilters(), SalesDashboardPage()

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (4): getSalesHistory(), handleGenerate(), calculateMovingAverage(), test()

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (12): getOcrStatusMap(), getVendorQuotationById(), mapToSerializable(), normalizeNullableText(), saveVendorQuotationDraft(), syncVendorQuotationsFromEpr(), buildLatestGrManualByPo(), EprIntegrasiPage() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.15
Nodes (7): formatCurrency(), formatDate(), getPendingQuotationAttachments(), getQuotationUrls(), handleAutoOcrPending(), runOcrBatch(), toggleEntrySelection()

### Community 45 - "Community 45"
Cohesion: 0.13
Nodes (6): DashboardThemeProvider(), useTheme(), SimpleThemeToggle(), ThemeToggle(), useMounted(), Toaster()

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (11): findHeader(), getStringValue(), handleDialogOpenChange(), handleFileSelect(), handleImport(), normalizeHeader(), parseDateValue(), parseGiFile() (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.19
Nodes (8): buildProductOptions(), buildSlowMovingRow(), getMaterialKey(), getMaterialNumber(), getStockAgeDays(), handleImportSelected(), handleRemoveImported(), parseNumber()

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (4): addSubItem(), removeCustomSubItem(), updateItem(), updateSubItem()

### Community 49 - "Community 49"
Cohesion: 0.19
Nodes (9): async(), navigateToNotificationTarget(), registerNotificationServiceWorker(), getQueryClient(), makeQueryClient(), Providers(), syncServiceWorkerRegistration(), isServiceWorkerEnabled() (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.27
Nodes (12): buildContent(), buildSlug(), buildSummary(), buildTags(), buildTitle(), describeRouteType(), getActorUserId(), main() (+4 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (5): generateNextRefNumber(), getCustomersForCoverLetter(), getSavedCoverLetters(), getSigners(), CoverLetterPage()

### Community 52 - "Community 52"
Cohesion: 0.23
Nodes (9): handleSelect(), applySelectedFiles(), createProgressTicker(), delay(), easeProgress(), hasMeaningfulBasicResult(), onDrop(), onSelect() (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.23
Nodes (7): bulkDeleteMasterPrices(), createOrUpdateMasterPrice(), deleteMasterPrice(), getErrorMessage(), importMasterPrices(), getErrorMessage(), startImport()

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (6): fetchGoodReceiveFromSAP(), processGoodReceive(), handleProcess(), main(), main(), main()

### Community 55 - "Community 55"
Cohesion: 0.17
Nodes (5): exportR49DashboardToExcel(), getR49DashboardFilters(), getDefaultR49Filters(), handleExport(), R49DashboardPage()

### Community 56 - "Community 56"
Cohesion: 0.2
Nodes (6): createNodeMachineDefinition(), createStandardNodeDefinition(), validateNodeMachineDefinition(), appendHistory(), nowIso(), validateApprovalMachineConfig()

### Community 57 - "Community 57"
Cohesion: 0.35
Nodes (11): addBase(), addCard(), addLayer(), addMetricCard(), addPill(), addProcessStep(), addRecommendation(), addTextBox() (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.2
Nodes (2): getPromptTemplate(), getVectorCartoonPromptTemplate()

### Community 60 - "Community 60"
Cohesion: 0.42
Nodes (8): getDetailGroupingKeys(), getDetailLookupKeys(), getNormalizedText(), getWorkOrderDetailKey(), isWaitingWorkOrder(), normalizeDetailJob(), normalizeTireSn(), normalizeValue()

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (6): buildPrintHtml(), createInitialFormState(), escapeHtml(), formatDate(), handlePrint(), todayValue()

### Community 63 - "Community 63"
Cohesion: 0.39
Nodes (7): buildCustomerCandidates(), callMistralChatCompletion(), getMessageContent(), parseJsonContent(), POST(), sanitizeText(), tryAiMapping()

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (6): mapOcrItemsToProductIds(), callMistralChatCompletion(), getMessageContent(), mapCustomerNameToId(), parseJsonContent(), POST()

### Community 65 - "Community 65"
Cohesion: 0.39
Nodes (7): compareNumber(), compareText(), EvhsAllVhsStockTable(), getCategoryPriority(), getStatusLabel(), getWarehouseLabel(), sortRows()

### Community 66 - "Community 66"
Cohesion: 0.25
Nodes (4): handleFileSelect(), downloadCSVTemplate(), generateCSVTemplate(), parseAndValidateCSV()

### Community 67 - "Community 67"
Cohesion: 0.53
Nodes (7): fetchPlatformData(), handleDelete(), handleImport(), handleSubmit(), isMissingServerActionError(), loadData(), runServerAction()

### Community 68 - "Community 68"
Cohesion: 0.31
Nodes (4): buildItemMap(), formatCurrency(), getChanges(), getItemTotal()

### Community 69 - "Community 69"
Cohesion: 0.31
Nodes (6): escapeHtml(), insertLink(), normalizeHtmlForEditor(), runCommand(), syncParallelApproverNames(), update()

### Community 70 - "Community 70"
Cohesion: 0.31
Nodes (5): buildInitialGraph(), buildMachineConfig(), getSortedApprovalNodes(), makeEdge(), WorkflowCanvas()

### Community 71 - "Community 71"
Cohesion: 0.44
Nodes (8): ensureApprovalSection(), getApprovalResourceByUrl(), main(), makeApprovalGroupItem(), makeItemId(), makeSectionId(), makeSubItem(), removeFromAdmin()

### Community 72 - "Community 72"
Cohesion: 0.32
Nodes (3): buildConfig(), handleSubmit(), validate()

### Community 73 - "Community 73"
Cohesion: 0.33
Nodes (2): handleSave(), validateDraft()

### Community 83 - "Community 83"
Cohesion: 0.4
Nodes (2): getDefaultFilters(), loadFiltersFromStorage()

### Community 84 - "Community 84"
Cohesion: 0.47
Nodes (3): extractRationaleJson(), isValidMLReportData(), stripCodeFence()

### Community 86 - "Community 86"
Cohesion: 0.53
Nodes (4): calculateGrandTotal(), calculateSubtotal(), calculateTotalDiscount(), calculateTotalTax()

### Community 87 - "Community 87"
Cohesion: 0.4
Nodes (2): calculatePrice(), calculateValuation()

### Community 91 - "Community 91"
Cohesion: 0.4
Nodes (2): toggleCheckbox(), updateAnswer()

### Community 93 - "Community 93"
Cohesion: 0.53
Nodes (4): filterKanbanItems(), getDeadlineBucket(), getGroupKey(), toTimeValue()

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

### Community 162 - "Community 162"
Cohesion: 0.67
Nodes (1): PrintChecklistLayout()

### Community 179 - "Community 179"
Cohesion: 1.0
Nodes (2): main(), splitSqlStatements()

### Community 180 - "Community 180"
Cohesion: 1.0
Nodes (2): main(), splitSqlStatements()

### Community 181 - "Community 181"
Cohesion: 1.0
Nodes (2): ensureMigrationTable(), main()

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (2): main(), normalizedTextSql()

### Community 183 - "Community 183"
Cohesion: 1.0
Nodes (2): loadRepairCandidates(), main()

## Knowledge Gaps
- **Thin community `Community 58`** (11 nodes): `instagram-image-generator-client.tsx`, `copyWearpackStyle()`, `downloadImage()`, `enhancePrompt()`, `formatDate()`, `generateImage()`, `generateVariations()`, `getPromptTemplate()`, `getVectorCartoonPromptTemplate()`, `onFilesChange()`, `removeAsset()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (7 nodes): `matrix-builder.tsx`, `addDraftNode()`, `handleSave()`, `makeTempId()`, `removeDraftNode()`, `updateDraftNode()`, `validateDraft()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (6 nodes): `filter-context.tsx`, `FilterProvider()`, `getDefaultFilters()`, `loadFiltersFromStorage()`, `saveFiltersToStorage()`, `useFilters()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (6 nodes): `stock-table.tsx`, `calculatePrice()`, `calculateValuation()`, `formatCurrency()`, `getBookingRemarkSummary()`, `getTotalBookingQty()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (6 nodes): `form-renderer.tsx`, `cn()`, `handleSubmit()`, `handleUploadAnswerFile()`, `toggleCheckbox()`, `updateAnswer()`
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
- **Thin community `Community 162`** (3 nodes): `layout.tsx`, `layout.tsx`, `PrintChecklistLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 179`** (3 nodes): `main()`, `splitSqlStatements()`, `apply-approval-migration.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 180`** (3 nodes): `main()`, `splitSqlStatements()`, `apply-approval-org-migration.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 181`** (3 nodes): `ensureMigrationTable()`, `main()`, `baseline-migrations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (3 nodes): `main()`, `normalizedTextSql()`, `fix-stock-product-sloc-mismatch.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (3 nodes): `loadRepairCandidates()`, `main()`, `repair-delivery-qty-anomalies.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `String()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 13`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 43`, `Community 44`, `Community 46`, `Community 47`, `Community 51`, `Community 55`, `Community 57`, `Community 63`, `Community 67`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Why does `getAuthenticatedSession()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 13`, `Community 14`, `Community 15`, `Community 18`, `Community 21`, `Community 25`, `Community 26`, `Community 28`, `Community 31`, `Community 32`, `Community 42`, `Community 54`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Why does `checkPermission()` connect `Community 7` to `Community 0`, `Community 4`, `Community 5`, `Community 6`, `Community 10`, `Community 25`, `Community 31`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 233 inferred relationships involving `getAuthenticatedSession()` (e.g. with `getA2RCompetitionFilterOptions()` and `getA2RCompetitionTargetSetup()`) actually correct?**
  _`getAuthenticatedSession()` has 233 INFERRED edges - model-reasoned connections that need verification._
- **Are the 163 inferred relationships involving `String()` (e.g. with `monthKey()` and `normalizeText()`) actually correct?**
  _`String()` has 163 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `checkPermission()` (e.g. with `getApprovalRequestDetail()` and `batchSyncInvoiceFromBilling()`) actually correct?**
  _`checkPermission()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `sendSystemTemplatedEmailByCode()` (e.g. with `createAssignmentsForStep()` and `runApprovalSlaEscalationJob()`) actually correct?**
  _`sendSystemTemplatedEmailByCode()` has 16 INFERRED edges - model-reasoned connections that need verification._