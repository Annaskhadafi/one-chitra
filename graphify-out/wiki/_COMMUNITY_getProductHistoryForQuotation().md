---
type: community
cohesion: 0.18
members: 11
---

# getProductHistoryForQuotation()

**Cohesion:** 0.18 - loosely connected
**Members:** 11 nodes

## Members
- [[getHistoryOrder()]] - code - app\actions\history-order.ts
- [[getHistoryOrderFilters()]] - code - app\actions\history-order.ts
- [[getProductHistoryForQuotation()]] - code - app\actions\history-order.ts
- [[history-order.ts]] - code - app\actions\history-order.ts
- [[importHistoryOrderBatch()]] - code - app\actions\history-order.ts
- [[main()_126]] - code - scripts\test-history-order.ts
- [[main()_128]] - code - scripts\test-quote-history-fixed.ts
- [[main()_129]] - code - scripts\test-quote-history.ts
- [[test-history-order.ts]] - code - scripts\test-history-order.ts
- [[test-quote-history-fixed.ts]] - code - scripts\test-quote-history-fixed.ts
- [[test-quote-history.ts]] - code - scripts\test-quote-history.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getProductHistoryForQuotation()
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_getWarehouses()]]

## Top bridge nodes
- [[getProductHistoryForQuotation()]] - degree 4, connects to 1 community