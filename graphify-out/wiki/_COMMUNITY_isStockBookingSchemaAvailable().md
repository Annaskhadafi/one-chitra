---
type: community
cohesion: 0.12
members: 25
---

# isStockBookingSchemaAvailable()

**Cohesion:** 0.12 - loosely connected
**Members:** 25 nodes

## Members
- [[bulkDeleteStocks()]] - code - app\actions\stock.ts
- [[bulkUpdateStockMinStock()]] - code - app\actions\stock.ts
- [[consolidateDuplicateStocks()]] - code - app\actions\stock.ts
- [[consumeStockBookingsForDelivery()]] - code - lib\stock-bookings.ts
- [[deleteStock()]] - code - app\actions\stock.ts
- [[exportInventoryComparisonToExcel()]] - code - app\actions\stock.ts
- [[getMatchingBookingRows()]] - code - lib\stock-bookings.ts
- [[getStockBookingAvailability()]] - code - lib\stock-bookings.ts
- [[getStockByMaterialNumber()]] - code - app\actions\stock.ts
- [[getStockByProductReference()]] - code - app\actions\stock.ts
- [[handleSubmit()_17]] - code - app\dashboard\stocks\_components\stock-dialog.tsx
- [[isStockBookingSchemaAvailable()]] - code - lib\stock-bookings.ts
- [[mergeStockBookingsForDuplicateGroup()]] - code - app\actions\stock.ts
- [[normalizeStockBookingEntries()]] - code - app\actions\stock.ts
- [[normalizeStockLogicalKeyPart()]] - code - app\actions\stock.ts
- [[onSubmit()_20]] - code - app\dashboard\sales-orders\_components\quick-add-product-dialog.tsx
- [[quick-add-product-dialog.tsx]] - code - app\dashboard\sales-orders\_components\quick-add-product-dialog.tsx
- [[resolveProductForStockLookup()]] - code - app\actions\stock.ts
- [[resolveRelatedProductIdsForStockLookup()]] - code - app\actions\stock.ts
- [[restoreStockBookingsForDelivery()]] - code - lib\stock-bookings.ts
- [[stock-bookings.ts_1]] - code - lib\stock-bookings.ts
- [[stock-dialog.tsx]] - code - app\dashboard\stocks\_components\stock-dialog.tsx
- [[stock.ts]] - code - app\actions\stock.ts
- [[syncStockBookings()]] - code - app\actions\stock.ts
- [[upsertStock()]] - code - app\actions\stock.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/isStockBookingSchemaAvailable()
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 3 edges to [[_COMMUNITY_getWarehouses()]]
- 2 edges to [[_COMMUNITY_createDelivery()]]
- 1 edge to [[_COMMUNITY_onSuccess()]]

## Top bridge nodes
- [[stock.ts]] - degree 16, connects to 1 community
- [[upsertStock()]] - degree 4, connects to 1 community
- [[normalizeStockLogicalKeyPart()]] - degree 3, connects to 1 community
- [[onSubmit()_20]] - degree 3, connects to 1 community
- [[handleSubmit()_17]] - degree 3, connects to 1 community