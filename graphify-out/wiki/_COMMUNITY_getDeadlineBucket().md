---
type: community
cohesion: 0.53
members: 6
---

# getDeadlineBucket()

**Cohesion:** 0.53 - moderately connected
**Members:** 6 nodes

## Members
- [[filterKanbanItems()]] - code - lib\kanban-utils.ts
- [[getDeadlineBucket()]] - code - lib\kanban-utils.ts
- [[getGroupKey()]] - code - lib\kanban-utils.ts
- [[isTransitionAllowed()]] - code - lib\kanban-utils.ts
- [[kanban-utils.ts]] - code - lib\kanban-utils.ts
- [[toTimeValue()]] - code - lib\kanban-utils.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getDeadlineBucket()
SORT file.name ASC
```
