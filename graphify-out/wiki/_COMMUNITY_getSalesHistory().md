---
type: community
cohesion: 0.12
members: 16
---

# getSalesHistory()

**Cohesion:** 0.12 - loosely connected
**Members:** 16 nodes

## Members
- [[ai-utils.ts]] - code - lib\ai-utils.ts
- [[calculateAccuracy()]] - code - lib\ai-utils.ts
- [[calculateMovingAverage()]] - code - lib\ai-utils.ts
- [[calculateUrgencyLevel()]] - code - lib\ai-utils.ts
- [[formatAccuracyWithColor()]] - code - lib\ai-utils.ts
- [[formatPredictionDate()]] - code - lib\ai-utils.ts
- [[formatUrgencyWithColor()]] - code - lib\ai-utils.ts
- [[generateBatchId()]] - code - lib\ai-utils.ts
- [[getDateRange()]] - code - lib\ai-utils.ts
- [[getDefaultAIConfig()]] - code - lib\ai-utils.ts
- [[getSalesHistory()]] - code - app\actions\inventory-ml.ts
- [[handleGenerate()_2]] - code - app\dashboard\inventory-ml\_components\predictive-replenishment.tsx
- [[isPredictionOlderThan()]] - code - lib\ai-utils.ts
- [[predictive-replenishment.tsx]] - code - app\dashboard\inventory-ml\_components\predictive-replenishment.tsx
- [[test()_2]] - code - scripts\test-ai-integration.ts
- [[test-ai-integration.ts]] - code - scripts\test-ai-integration.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getSalesHistory()
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_getSafetyStockAnalytics()]]
- 1 edge to [[_COMMUNITY_getAuthenticatedSession()]]

## Top bridge nodes
- [[getSalesHistory()]] - degree 5, connects to 1 community