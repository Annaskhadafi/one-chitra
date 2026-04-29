---
type: community
cohesion: 1.00
members: 2
---

# scanFiles()

**Cohesion:** 1.00 - tightly connected
**Members:** 2 nodes

## Members
- [[audit-server-actions.js]] - code - scripts\audit-server-actions.js
- [[scanFiles()]] - code - scripts\audit-server-actions.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/scanFiles()
SORT file.name ASC
```
