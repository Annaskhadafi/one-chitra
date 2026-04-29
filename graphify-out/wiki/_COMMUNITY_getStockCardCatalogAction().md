---
type: community
cohesion: 0.09
members: 32
---

# getStockCardCatalogAction()

**Cohesion:** 0.09 - loosely connected
**Members:** 32 nodes

## Members
- [[PrintStockCardPage()]] - code - app\print\stock-card\page.tsx
- [[StockCardPage()]] - code - app\dashboard\stock-card\page.tsx
- [[app-url.ts]] - code - lib\app-url.ts
- [[auth.ts_1]] - code - lib\auth.ts
- [[formatDate()_26]] - code - lib\stock-card.ts
- [[getCanonicalAppUrl()]] - code - lib\app-url.ts
- [[getStockCardBaseRows()]] - code - lib\stock-card.ts
- [[getStockCardCatalog()]] - code - lib\stock-card.ts
- [[getStockCardCatalogAction()]] - code - app\actions\stock-card.ts
- [[getStockCardDetail()]] - code - lib\stock-card.ts
- [[getStockCardDetailAction()]] - code - app\actions\stock-card.ts
- [[getStockCardLabelsByIds()]] - code - lib\stock-card.ts
- [[getStockCardLabelsByIdsAction()]] - code - app\actions\stock-card.ts
- [[getStockCardPrintLayoutConfig()]] - code - lib\stock-card-print.ts
- [[getStockCardScanUrl()]] - code - lib\stock-card.ts
- [[isStockCardPrintLayout()]] - code - lib\stock-card-print.ts
- [[mapBaseRow()]] - code - lib\stock-card.ts
- [[normalizeUrl()]] - code - lib\auth.ts
- [[page.tsx_107]] - code - app\dashboard\stock-card\page.tsx
- [[page.tsx_131]] - code - app\print\stock-card\page.tsx
- [[parseIds()]] - code - app\print\stock-card\page.tsx
- [[parseStockCardPrintLayout()]] - code - lib\stock-card-print.ts
- [[resolveBaseURL()]] - code - lib\auth.ts
- [[shouldEnforceStrictAuthSecret()]] - code - lib\auth.ts
- [[stock-card-print.ts]] - code - lib\stock-card-print.ts
- [[stock-card.ts]] - code - app\actions\stock-card.ts
- [[stock-card.ts_1]] - code - lib\stock-card.ts
- [[stripTrailingSlash()]] - code - lib\app-url.ts
- [[toCanonicalAppUrl()]] - code - lib\app-url.ts
- [[toNumber()_2]] - code - lib\stock-card.ts
- [[toTimestamp()]] - code - lib\stock-card.ts
- [[validateBetterAuthSecret()]] - code - lib\auth.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getStockCardCatalogAction()
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 2 edges to [[_COMMUNITY_getWarehouses()]]
- 1 edge to [[_COMMUNITY_createGoodReceiveManual()]]
- 1 edge to [[_COMMUNITY_readManagedUpload()]]

## Top bridge nodes
- [[getStockCardCatalogAction()]] - degree 5, connects to 2 communities
- [[getStockCardLabelsByIdsAction()]] - degree 5, connects to 2 communities
- [[getStockCardDetailAction()]] - degree 3, connects to 1 community