---
source_file: "app\actions\sales-order.ts"
type: "code"
community: "createSalesOrder()"
location: "L465"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/createSalesOrder()
---

# createSalesOrder()

## Connections
- [[String()]] - `calls` [INFERRED]
- [[duplicateCustomerPoResult()]] - `calls` [EXTRACTED]
- [[findExistingSalesOrderByCustomerPo()]] - `calls` [EXTRACTED]
- [[generateInvoiceNumber()]] - `calls` [EXTRACTED]
- [[getAuthenticatedSession()]] - `calls` [INFERRED]
- [[hasSalesPersonColumn()]] - `calls` [EXTRACTED]
- [[normalizeCustomerPo()]] - `calls` [EXTRACTED]
- [[sendSalesOrderCreatedNotification()]] - `calls` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/createSalesOrder()