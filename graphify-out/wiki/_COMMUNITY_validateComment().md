---
type: community
cohesion: 0.20
members: 12
---

# validateComment()

**Cohesion:** 0.20 - loosely connected
**Members:** 12 nodes

## Members
- [[action-panel.tsx]] - code - app\dashboard\approvals\_components\action-panel.tsx
- [[applyStatusFilters()]] - code - app\dashboard\approvals\_lib\utils.ts
- [[canRevert()]] - code - app\dashboard\approvals\_lib\utils.ts
- [[deriveStepType()]] - code - app\dashboard\approvals\_lib\utils.ts
- [[handleDecision()]] - code - app\dashboard\approvals\_components\action-panel.tsx
- [[handleRevert()]] - code - app\dashboard\approvals\_components\action-panel.tsx
- [[hasAnyApproverDecision()]] - code - app\dashboard\approvals\_lib\utils.ts
- [[sortTimelineEntries()]] - code - app\dashboard\approvals\_lib\utils.ts
- [[utils.ts]] - code - app\dashboard\approvals\_lib\utils.ts
- [[validateComment()]] - code - app\dashboard\approvals\_components\action-panel.tsx
- [[validateNotePolicy()]] - code - app\dashboard\approvals\_lib\utils.ts
- [[validateStepReorder()]] - code - app\dashboard\approvals\_lib\utils.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/validateComment()
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_getAuthenticatedSession()]]
