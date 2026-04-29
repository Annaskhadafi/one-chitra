---
type: community
cohesion: 0.70
members: 5
---

# isVendorQuotationFromYear()

**Cohesion:** 0.70 - tightly connected
**Members:** 5 nodes

## Members
- [[hasYearToken()]] - code - lib\vendor-quotation-filter.ts
- [[isVendorQuotationFrom2026()]] - code - lib\vendor-quotation-filter.ts
- [[isVendorQuotationFromYear()]] - code - lib\vendor-quotation-filter.ts
- [[tryExtractYearFromDate()]] - code - lib\vendor-quotation-filter.ts
- [[vendor-quotation-filter.ts]] - code - lib\vendor-quotation-filter.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/isVendorQuotationFromYear()
SORT file.name ASC
```
