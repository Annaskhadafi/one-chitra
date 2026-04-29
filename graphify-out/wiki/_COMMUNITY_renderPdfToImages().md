---
type: community
cohesion: 0.05
members: 75
---

# renderPdfToImages()

**Cohesion:** 0.05 - loosely connected
**Members:** 75 nodes

## Members
- [[POST()_2]] - code - app\api\do-scan-ocr\route.ts
- [[POST()_14]] - code - app\api\ocr-vendor-quotation\route.ts
- [[askHelpDeskOllama()]] - code - app\actions\helpdesk-ai.ts
- [[buildFocusedText()]] - code - lib\ollama-vision-ocr.ts
- [[buildHelpDeskFallbackAnswer()]] - code - lib\helpdesk-assistant.ts
- [[buildHelpDeskSystemPrompt()]] - code - lib\helpdesk-assistant.ts
- [[buildKnowledgeDraftFromDocument()]] - code - app\actions\helpdesk-ai.ts
- [[buildPageListingAnswer()]] - code - lib\helpdesk-assistant.ts
- [[buildRuleBasedAnswer()]] - code - lib\helpdesk-assistant.ts
- [[capturePdfDocumentViewport()]] - code - lib\ollama-vision-ocr.ts
- [[countPopulatedFields()]] - code - lib\ollama-vision-ocr.ts
- [[deleteHelpDeskKnowledgeSource()]] - code - app\actions\helpdesk-ai.ts
- [[detectPdfPageCount()]] - code - lib\ollama-vision-ocr.ts
- [[ensureBotUser()]] - code - app\actions\helpdesk-ai.ts
- [[ensureHelpDeskKnowledgeSeed()]] - code - app\actions\helpdesk-ai.ts
- [[ensureHelpDeskRoom()]] - code - app\actions\helpdesk-ai.ts
- [[ensureHelpDeskSchema()]] - code - lib\helpdesk-schema.ts
- [[extractDeliveryOrderFields()]] - code - lib\ollama-vision-ocr.ts
- [[extractDeliveryOrderSection()]] - code - lib\ollama-vision-ocr.ts
- [[extractHelpDeskKnowledgeFromDocument()]] - code - app\actions\helpdesk-ai.ts
- [[extractInternalNo()_1]] - code - app\api\do-scan-ocr\route.ts
- [[extractJsonFromText()_1]] - code - lib\ocr-utils.ts
- [[extractKeywords()]] - code - lib\helpdesk-assistant.ts
- [[extractRawText()]] - code - lib\ollama-vision-ocr.ts
- [[extractRawTextFromDocumentViaOllama()]] - code - lib\ollama-vision-ocr.ts
- [[extractStructuredFromPoViaOllama()]] - code - lib\ollama-so-ocr.ts
- [[extractVendorQuotationOcr()]] - code - app\api\ocr-vendor-quotation\route.ts
- [[extractVendorQuotationViaOllama()]] - code - lib\ollama-vendor-quotation.ts
- [[fetchFileFromUrl()]] - code - app\api\ocr-vendor-quotation\route.ts
- [[findField()]] - code - lib\ollama-vision-ocr.ts
- [[forceDeliveryYear2026()_1]] - code - app\api\do-scan-ocr\route.ts
- [[forceDeliveryYear2026()_2]] - code - lib\ollama-vision-ocr.ts
- [[generateHelpDeskReply()]] - code - app\actions\helpdesk-ai.ts
- [[getCurrentUserId()_1]] - code - app\actions\helpdesk-ai.ts
- [[getHelpDeskKnowledgeDashboard()]] - code - app\actions\helpdesk-ai.ts
- [[getHelpDeskStarterPrompts()]] - code - app\actions\helpdesk-ai.ts
- [[getHelpDeskTrainingData()]] - code - app\actions\helpdesk-ai.ts
- [[getMessageContent()_2]] - code - lib\ollama-vision-ocr.ts
- [[helpdesk-ai.ts]] - code - app\actions\helpdesk-ai.ts
- [[helpdesk-assistant.ts]] - code - lib\helpdesk-assistant.ts
- [[helpdesk-schema.ts]] - code - lib\helpdesk-schema.ts
- [[isPageListingQuestion()]] - code - lib\helpdesk-assistant.ts
- [[jumpToPdfPage()]] - code - lib\ollama-vision-ocr.ts
- [[normalize()]] - code - lib\helpdesk-assistant.ts
- [[normalizeExtractedQuotation()]] - code - app\api\ocr-vendor-quotation\route.ts
- [[normalizeImageToBase64()]] - code - lib\ollama-vision-ocr.ts
- [[normalizeInternalNo()_1]] - code - app\api\do-scan-ocr\route.ts
- [[normalizeInternalNo()_2]] - code - lib\ollama-vision-ocr.ts
- [[normalizePages()_1]] - code - lib\ollama-vision-ocr.ts
- [[normalizePdfViewerScreenshot()]] - code - lib\ollama-vision-ocr.ts
- [[ocr-utils.ts]] - code - lib\ocr-utils.ts
- [[ollama-so-ocr.ts]] - code - lib\ollama-so-ocr.ts
- [[ollama-vendor-quotation.ts]] - code - lib\ollama-vendor-quotation.ts
- [[ollama-vision-ocr.ts]] - code - lib\ollama-vision-ocr.ts
- [[pickRequestedPages()]] - code - lib\ollama-vision-ocr.ts
- [[prepareDocumentPages()]] - code - lib\ollama-vision-ocr.ts
- [[prepareImageForOllama()]] - code - lib\ollama-so-ocr.ts
- [[prepareImageForOllama()_1]] - code - lib\ollama-vendor-quotation.ts
- [[renderPdfToImages()]] - code - lib\ollama-vision-ocr.ts
- [[route.ts_10]] - code - app\api\do-scan-ocr\route.ts
- [[route.ts_24]] - code - app\api\ocr-vendor-quotation\route.ts
- [[sanitizeHelpDeskReplyText()]] - code - lib\helpdesk-assistant.ts
- [[sanitizeOcrText()]] - code - lib\ocr-utils.ts
- [[sanitizeText()_1]] - code - app\api\do-scan-ocr\route.ts
- [[scoreCandidate()]] - code - lib\helpdesk-assistant.ts
- [[scoreText()]] - code - lib\helpdesk-assistant.ts
- [[searchHelpDeskKnowledge()]] - code - lib\helpdesk-assistant.ts
- [[selectDisplayText()_1]] - code - app\api\do-scan-ocr\route.ts
- [[setHelpDeskKnowledgeActive()]] - code - app\actions\helpdesk-ai.ts
- [[sleep()]] - code - lib\ollama-vision-ocr.ts
- [[splitIntoChunks()]] - code - app\actions\helpdesk-ai.ts
- [[splitIntoSentences()]] - code - lib\helpdesk-assistant.ts
- [[syncHelpDeskSchema()]] - code - lib\helpdesk-schema.ts
- [[trainHelpDeskFromPage()]] - code - app\actions\helpdesk-ai.ts
- [[waitForPdfViewerPaint()]] - code - lib\ollama-vision-ocr.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/renderPdfToImages()
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 4 edges to [[_COMMUNITY_readManagedUpload()]]
- 1 edge to [[_COMMUNITY_getCurrentUserId()]]
- 1 edge to [[_COMMUNITY_extractStructuredFromDocument()]]
- 1 edge to [[_COMMUNITY_uploadFile()]]

## Top bridge nodes
- [[renderPdfToImages()]] - degree 12, connects to 1 community
- [[extractRawTextFromDocumentViaOllama()]] - degree 11, connects to 1 community
- [[POST()_2]] - degree 7, connects to 1 community
- [[extractHelpDeskKnowledgeFromDocument()]] - degree 6, connects to 1 community
- [[sanitizeText()_1]] - degree 5, connects to 1 community