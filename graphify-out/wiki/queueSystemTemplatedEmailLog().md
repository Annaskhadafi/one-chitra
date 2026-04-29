---
source_file: "lib\email.ts"
type: "code"
community: "sendSystemTemplatedEmailByCode()"
location: "L688"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/sendSystemTemplatedEmailByCode()
---

# queueSystemTemplatedEmailLog()

## Connections
- [[ensureSystemEmailTemplates()]] - `calls` [INFERRED]
- [[getDefaultDeliveryChannelsForTemplate()]] - `calls` [INFERRED]
- [[getEmailTemplateByCode()]] - `calls` [EXTRACTED]
- [[getSystemEmailTemplateDefinition()]] - `calls` [INFERRED]
- [[isRevenueReportTemplateManagedByAutomation()]] - `calls` [INFERRED]
- [[normalizeDeliveryChannels()]] - `calls` [EXTRACTED]
- [[normalizeEmailList()_1]] - `calls` [EXTRACTED]
- [[normalizeSystemTemplateData()]] - `calls` [EXTRACTED]
- [[replaceTemplateVariables()]] - `calls` [EXTRACTED]
- [[resolveActionUrlFromTemplateData()]] - `calls` [EXTRACTED]
- [[resolveUserEmailsFromRolesAndIds()]] - `calls` [EXTRACTED]
- [[writeEmailLog()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/sendSystemTemplatedEmailByCode()