---
type: community
cohesion: 0.24
members: 13
---

# getLogisticsMasterPrices()

**Cohesion:** 0.24 - loosely connected
**Members:** 13 nodes

## Members
- [[LogisticsMasterPricePage()]] - code - app\dashboard\logistics-costs\master-price\page.tsx
- [[MasterPriceDeliveryModalPage()]] - code - app\master-price-delivery-modal\page.tsx
- [[buildPayload()]] - code - app\actions\logistics-master-price.ts
- [[deleteLogisticsMasterPrice()]] - code - app\actions\logistics-master-price.ts
- [[getLogisticsMasterPrices()]] - code - app\actions\logistics-master-price.ts
- [[importLogisticsMasterPrices()]] - code - app\actions\logistics-master-price.ts
- [[isMissingTableError()]] - code - app\actions\logistics-master-price.ts
- [[logistics-master-price.ts]] - code - app\actions\logistics-master-price.ts
- [[normalizeNullableNumber()]] - code - app\actions\logistics-master-price.ts
- [[normalizeNullableString()]] - code - app\actions\logistics-master-price.ts
- [[page.tsx_57]] - code - app\dashboard\logistics-costs\master-price\page.tsx
- [[page.tsx_130]] - code - app\master-price-delivery-modal\page.tsx
- [[upsertLogisticsMasterPrice()]] - code - app\actions\logistics-master-price.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getLogisticsMasterPrices()
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_getAuthenticatedSession()]]

## Top bridge nodes
- [[getLogisticsMasterPrices()]] - degree 5, connects to 1 community
- [[upsertLogisticsMasterPrice()]] - degree 4, connects to 1 community
- [[deleteLogisticsMasterPrice()]] - degree 3, connects to 1 community
- [[importLogisticsMasterPrices()]] - degree 3, connects to 1 community