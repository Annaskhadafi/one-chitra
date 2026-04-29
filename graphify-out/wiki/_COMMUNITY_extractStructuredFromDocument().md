---
type: community
cohesion: 0.17
members: 24
---

# extractStructuredFromDocument()

**Cohesion:** 0.17 - loosely connected
**Members:** 24 nodes

## Members
- [[POST()_11]] - code - app\api\ocr-extract-basic\route.ts
- [[POST()_10]] - code - app\api\ocr-extract\route.ts
- [[buildDataUri()]] - code - lib\mistral-ocr.ts
- [[extractJsonFromText()]] - code - lib\mistral-ocr.ts
- [[extractRawTextFromDocument()]] - code - lib\mistral-ocr.ts
- [[extractStructuredFromDocument()]] - code - lib\mistral-ocr.ts
- [[getBboxAnnotationInput()]] - code - lib\mistral-ocr.ts
- [[getDocumentAnnotationInput()]] - code - lib\mistral-ocr.ts
- [[getErrorMessage()_2]] - code - app\api\ocr-extract\route.ts
- [[getExistingOcrInsertProcedureName()]] - code - app\api\ocr-extract\route.ts
- [[getRawText()]] - code - lib\mistral-ocr.ts
- [[hasMeaningfulBasicResult()_1]] - code - app\api\ocr-extract-basic\route.ts
- [[insertOcrSessionWithFallback()]] - code - app\api\ocr-extract\route.ts
- [[mistral-ocr.ts]] - code - lib\mistral-ocr.ts
- [[normalizeDocumentForOcr()]] - code - lib\mistral-ocr.ts
- [[normalizePages()]] - code - lib\mistral-ocr.ts
- [[normalizeProducts()]] - code - app\api\ocr-extract\route.ts
- [[parseJsonLike()]] - code - lib\mistral-ocr.ts
- [[route.ts_21]] - code - app\api\ocr-extract-basic\route.ts
- [[route.ts_20]] - code - app\api\ocr-extract\route.ts
- [[sanitizeNullableText()]] - code - app\api\ocr-extract\route.ts
- [[sanitizeText()_3]] - code - app\api\ocr-extract-basic\route.ts
- [[sanitizeText()_2]] - code - app\api\ocr-extract\route.ts
- [[toBasicPayload()_1]] - code - app\api\ocr-extract-basic\route.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/extractStructuredFromDocument()
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 3 edges to [[_COMMUNITY_readManagedUpload()]]
- 2 edges to [[_COMMUNITY_Boolean()]]
- 1 edge to [[_COMMUNITY_uploadFile()]]
- 1 edge to [[_COMMUNITY_renderPdfToImages()]]

## Top bridge nodes
- [[POST()_11]] - degree 9, connects to 4 communities
- [[POST()_10]] - degree 7, connects to 1 community
- [[sanitizeText()_3]] - degree 4, connects to 1 community
- [[sanitizeText()_2]] - degree 4, connects to 1 community
- [[getErrorMessage()_2]] - degree 3, connects to 1 community