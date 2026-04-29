---
type: community
cohesion: 0.06
members: 80
---

# readManagedUpload()

**Cohesion:** 0.06 - loosely connected
**Members:** 80 nodes

## Members
- [[GET()_13]] - code - app\api\stock-alerts\export\route.ts
- [[GET()_15]] - code - app\api\uploads\[filename]\route.ts
- [[OpnameDetailView()]] - code - app\dashboard\stock-opname\_components\opname-detail-view.tsx
- [[POST()_15]] - code - app\api\sales-documents\upload\route.ts
- [[POST()_16]] - code - app\api\uploads\route.ts
- [[SettlementDetailPage()]] - code - app\dashboard\cost-settlements\[id]\page.tsx
- [[buildObjectStorageKey()]] - code - lib\upload-storage.ts
- [[collectFilesRecursively()]] - code - scripts\migrate-uploads-to-object-storage.ts
- [[createManagedUploadFilename()]] - code - lib\upload-storage.ts
- [[deleteManagedUpload()]] - code - lib\upload-storage.ts
- [[extractInternalNo()]] - code - app\actions\ocr-fast.ts
- [[extractUploadFilename()]] - code - lib\upload-url.ts
- [[fetchRemoteUpload()]] - code - app\api\uploads\[filename]\route.ts
- [[findExistingUploadFilePath()]] - code - lib\upload-storage.ts
- [[forceDeliveryYear2026()]] - code - app\actions\ocr-fast.ts
- [[formatCurrency()_2]] - code - app\dashboard\cost-settlements\[id]\page.tsx
- [[getContentTypeByExtension()]] - code - lib\upload-storage.ts
- [[getEnvValue()]] - code - lib\upload-storage.ts
- [[getErrorMessage()_1]] - code - app\actions\ocr-fast.ts
- [[getFallbackOrigins()]] - code - app\api\uploads\[filename]\route.ts
- [[getManagedUploadUrl()]] - code - lib\upload-storage.ts
- [[getObjectStorageClient()]] - code - lib\upload-storage.ts
- [[getObjectStorageConfig()]] - code - lib\upload-storage.ts
- [[getObjectStorageTimeoutMs()]] - code - lib\upload-storage.ts
- [[getReorderAlertSummary()]] - code - app\actions\stock-alerts.ts
- [[getReorderAlerts()]] - code - app\actions\stock-alerts.ts
- [[getSettlementById()]] - code - app\actions\cost-settlement.ts
- [[getUploadContentType()]] - code - lib\upload-storage.ts
- [[getUploadDir()]] - code - lib\upload-dir.ts
- [[getUploadDriver()]] - code - lib\upload-storage.ts
- [[getUploadReadDirs()]] - code - lib\upload-storage.ts
- [[getUploadWriteDir()]] - code - lib\upload-storage.ts
- [[hasMeaningfulBasicResult()]] - code - app\actions\ocr-fast.ts
- [[isObjectStorageEnabled()]] - code - lib\upload-storage.ts
- [[isObjectStorageNotFoundError()]] - code - lib\upload-storage.ts
- [[isTransientObjectStorageUploadError()]] - code - lib\upload-storage.ts
- [[isUploadImageFile()]] - code - lib\upload-url.ts
- [[main()_101]] - code - scripts\migrate-uploads-to-object-storage.ts
- [[main()_127]] - code - scripts\test-object-storage-smoke.ts
- [[migrate-uploads-to-object-storage.ts]] - code - scripts\migrate-uploads-to-object-storage.ts
- [[normalizeBoolean()]] - code - lib\upload-storage.ts
- [[normalizeInternalNo()]] - code - app\actions\ocr-fast.ts
- [[normalizeNumber()_2]] - code - lib\upload-storage.ts
- [[normalizeObjectStorageEndpoint()]] - code - lib\upload-storage.ts
- [[normalizeOrigin()]] - code - app\api\uploads\[filename]\route.ts
- [[normalizeUploadFilename()]] - code - lib\upload-storage.ts
- [[ocr-fast.ts]] - code - app\actions\ocr-fast.ts
- [[page.tsx_22]] - code - app\dashboard\cost-settlements\[id]\page.tsx
- [[parseOptions()]] - code - scripts\migrate-uploads-to-object-storage.ts
- [[parseOptions()_1]] - code - scripts\test-object-storage-smoke.ts
- [[projectPath()]] - code - lib\upload-storage.ts
- [[readManagedUpload()]] - code - lib\upload-storage.ts
- [[requireObjectStorageConfig()]] - code - lib\upload-storage.ts
- [[resolveUploadDocumentUrl()]] - code - lib\upload-url.ts
- [[route.ts_25]] - code - app\api\sales-documents\upload\route.ts
- [[route.ts_26]] - code - app\api\settlements\[id]\export\route.ts
- [[route.ts_27]] - code - app\api\stock-alerts\export\route.ts
- [[route.ts_30]] - code - app\api\uploads\[filename]\route.ts
- [[route.ts_29]] - code - app\api\uploads\route.ts
- [[safeDecodeURIComponent()]] - code - lib\upload-url.ts
- [[sanitizeText()]] - code - app\actions\ocr-fast.ts
- [[saveManagedUpload()]] - code - lib\upload-storage.ts
- [[saveUploadToLocalDisk()]] - code - lib\upload-storage.ts
- [[selectDisplayText()]] - code - app\actions\ocr-fast.ts
- [[sendObjectStorageCommand()]] - code - lib\upload-storage.ts
- [[shouldAllowLocalUploadFallback()]] - code - lib\upload-storage.ts
- [[stock-alerts.ts]] - code - app\actions\stock-alerts.ts
- [[stripQueryAndHash()]] - code - lib\upload-url.ts
- [[test-object-storage-smoke.ts]] - code - scripts\test-object-storage-smoke.ts
- [[toAbsoluteUploadDocumentUrl()]] - code - lib\upload-url.ts
- [[toBasicPayload()]] - code - app\actions\ocr-fast.ts
- [[toBuffer()]] - code - lib\upload-storage.ts
- [[triggerDoScanOcrFast()]] - code - app\actions\ocr-fast.ts
- [[triggerSalesOrderBasicOcrFast()]] - code - app\actions\ocr-fast.ts
- [[tryExtractStructured()]] - code - app\actions\ocr-fast.ts
- [[uniquePaths()]] - code - lib\upload-storage.ts
- [[upload-dir.ts]] - code - lib\upload-dir.ts
- [[upload-storage.ts]] - code - lib\upload-storage.ts
- [[upload-url.ts]] - code - lib\upload-url.ts
- [[uploadLocalFileToObjectStorage()]] - code - lib\upload-storage.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/readManagedUpload()
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 5 edges to [[_COMMUNITY_uploadFile()]]
- 4 edges to [[_COMMUNITY_renderPdfToImages()]]
- 3 edges to [[_COMMUNITY_extractStructuredFromDocument()]]
- 2 edges to [[_COMMUNITY_getWarehouses()]]
- 2 edges to [[_COMMUNITY_getGeneratedAvatarDataUri()]]
- 1 edge to [[_COMMUNITY_getCurrentUserId()]]
- 1 edge to [[_COMMUNITY_getSettlementSession()]]
- 1 edge to [[_COMMUNITY_createGoodReceiveManual()]]
- 1 edge to [[_COMMUNITY_Boolean()]]
- 1 edge to [[_COMMUNITY_generateMarketingMagicAnalysis()]]
- 1 edge to [[_COMMUNITY_getSafetyStockAnalytics()]]
- 1 edge to [[_COMMUNITY_generateQuotationPdf()]]
- 1 edge to [[_COMMUNITY_startProcess()]]
- 1 edge to [[_COMMUNITY_getOpnameAuthSession()]]
- 1 edge to [[_COMMUNITY_getStockCardCatalogAction()]]

## Top bridge nodes
- [[triggerSalesOrderBasicOcrFast()]] - degree 11, connects to 2 communities
- [[stock-alerts.ts]] - degree 4, connects to 2 communities
- [[triggerDoScanOcrFast()]] - degree 9, connects to 1 community
- [[sanitizeText()]] - degree 7, connects to 1 community
- [[GET()_13]] - degree 7, connects to 1 community