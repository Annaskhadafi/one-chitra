---
type: community
cohesion: 0.50
members: 4
---

# containsExcludedTerm()

**Cohesion:** 0.50 - moderately connected
**Members:** 4 nodes

## Members
- [[containsExcludedTerm()]] - code - lib\wip-repair-visibility.ts
- [[isVisibleWipRepairRecord()]] - code - lib\wip-repair-visibility.ts
- [[isVisibleWipRepairWorkOrderDetail()]] - code - lib\wip-repair-visibility.ts
- [[wip-repair-visibility.ts]] - code - lib\wip-repair-visibility.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/containsExcludedTerm()
SORT file.name ASC
```
