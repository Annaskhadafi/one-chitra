---
type: community
cohesion: 0.14
members: 23
---

# getSettlementSession()

**Cohesion:** 0.14 - loosely connected
**Members:** 23 nodes

## Members
- [[CostSettlementsPage()]] - code - app\dashboard\cost-settlements\page.tsx
- [[LogisticsCostsPage()]] - code - app\dashboard\logistics-costs\page.tsx
- [[cost-settlement.ts]] - code - app\actions\cost-settlement.ts
- [[createSettlement()]] - code - app\actions\cost-settlement.ts
- [[deleteSettlement()]] - code - app\actions\cost-settlement.ts
- [[formatCurrency()_1]] - code - app\dashboard\cost-settlements\page.tsx
- [[generateSettlementNumber()]] - code - app\actions\cost-settlement.ts
- [[getLatestSettlementByDeliveryIds()]] - code - app\actions\cost-settlement.ts
- [[getLatestSettlementByFleetTripIds()]] - code - app\actions\cost-settlement.ts
- [[getLogisticsCosts()]] - code - app\actions\delivery.ts
- [[getSettlementSession()]] - code - app\actions\cost-settlement.ts
- [[getSettlementSummary()]] - code - app\actions\cost-settlement.ts
- [[getSettlements()]] - code - app\actions\cost-settlement.ts
- [[mapSettlementErrorMessage()]] - code - app\actions\cost-settlement.ts
- [[page.tsx_20]] - code - app\dashboard\cost-settlements\page.tsx
- [[page.tsx_56]] - code - app\dashboard\logistics-costs\page.tsx
- [[parseDecimal()]] - code - app\actions\cost-settlement.ts
- [[postSettlement()]] - code - app\actions\cost-settlement.ts
- [[resolveSettlementContext()]] - code - app\actions\cost-settlement.ts
- [[sumCostFields()]] - code - app\actions\cost-settlement.ts
- [[toDateOnly()]] - code - app\actions\cost-settlement.ts
- [[updateSettlement()]] - code - app\actions\cost-settlement.ts
- [[uploadSettlementReceipt()]] - code - app\actions\cost-settlement.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getSettlementSession()
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 1 edge to [[_COMMUNITY_readManagedUpload()]]
- 1 edge to [[_COMMUNITY_uploadFile()]]
- 1 edge to [[_COMMUNITY_createDelivery()]]
- 1 edge to [[_COMMUNITY_checkPermission()]]

## Top bridge nodes
- [[cost-settlement.ts]] - degree 18, connects to 2 communities
- [[getSettlementSession()]] - degree 8, connects to 1 community
- [[generateSettlementNumber()]] - degree 3, connects to 1 community
- [[uploadSettlementReceipt()]] - degree 3, connects to 1 community
- [[getLogisticsCosts()]] - degree 3, connects to 1 community