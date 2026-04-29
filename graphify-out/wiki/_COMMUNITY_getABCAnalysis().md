---
type: community
cohesion: 1.00
members: 3
---

# getABCAnalysis()

**Cohesion:** 1.00 - tightly connected
**Members:** 3 nodes

## Members
- [[abc-analysis.ts]] - code - app\actions\abc-analysis.ts
- [[getABCAnalysis()]] - code - app\actions\abc-analysis.ts
- [[getABCSummary()]] - code - app\actions\abc-analysis.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getABCAnalysis()
SORT file.name ASC
```
