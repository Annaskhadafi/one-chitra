---
type: community
cohesion: 1.00
members: 2
---

# getAuditLogs()

**Cohesion:** 1.00 - tightly connected
**Members:** 2 nodes

## Members
- [[audit.ts]] - code - app\actions\audit.ts
- [[getAuditLogs()]] - code - app\actions\audit.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/getAuditLogs()
SORT file.name ASC
```
