---
type: community
cohesion: 0.25
members: 9
---

# handleFileSelect()

**Cohesion:** 0.25 - loosely connected
**Members:** 9 nodes

## Members
- [[csv-upload.tsx]] - code - app\dashboard\inventory-ml\_components\csv-upload.tsx
- [[csv-utils.ts]] - code - lib\csv-utils.ts
- [[downloadCSVTemplate()]] - code - lib\csv-utils.ts
- [[generateCSVTemplate()]] - code - lib\csv-utils.ts
- [[handleBrowseClick()]] - code - app\dashboard\inventory-ml\_components\csv-upload.tsx
- [[handleClear()]] - code - app\dashboard\inventory-ml\_components\csv-upload.tsx
- [[handleFileSelect()_2]] - code - app\dashboard\inventory-ml\_components\csv-upload.tsx
- [[parseAndValidateCSV()]] - code - lib\csv-utils.ts
- [[validateCommaSeparatedMaterials()]] - code - lib\csv-utils.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/handleFileSelect()
SORT file.name ASC
```
