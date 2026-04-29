---
type: community
cohesion: 0.04
members: 84
---

# createDelivery()

**Cohesion:** 0.04 - loosely connected
**Members:** 84 nodes

## Members
- [[CreateCostSettlementPage()]] - code - app\dashboard\cost-settlements\create\page.tsx
- [[CreateDeliveryPage()]] - code - app\dashboard\deliveries\create\page.tsx
- [[CreateFleetTripPage()]] - code - app\dashboard\fleet-management\create\page.tsx
- [[DeliveriesPage()]] - code - app\dashboard\deliveries\page.tsx
- [[DoMonitoringPage()]] - code - app\dashboard\do-monitoring\page.tsx
- [[FleetManagementPage()]] - code - app\dashboard\fleet-management\page.tsx
- [[TestDeliveryPage()]] - code - app\dashboard\test-delivery-page\page.tsx
- [[adjustOriginWarehouseStock()]] - code - app\actions\delivery.ts
- [[assertOriginWarehouseStock()]] - code - app\actions\delivery.ts
- [[buildDeliveryItemQuantityMap()]] - code - app\actions\delivery.ts
- [[buildDeliveryItemRows()]] - code - lib\delivery-notifications.ts
- [[buildDeliveryStockCheckResult()]] - code - app\actions\delivery.ts
- [[buildItemSummaries()]] - code - lib\delivery-notifications.ts
- [[bulkAttachDoScansByInternalNo()]] - code - app\actions\delivery.ts
- [[bulkUpdateDeliveryStatus()]] - code - app\actions\delivery.ts
- [[checkAndCompleteSalesOrder()]] - code - app\actions\delivery.ts
- [[checkStockAvailability()]] - code - app\actions\delivery.ts
- [[clearLogisticsCosts()]] - code - app\actions\delivery.ts
- [[cn()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[createDelivery()]] - code - app\actions\delivery.ts
- [[createDriver()]] - code - app\actions\fleet.ts
- [[createVehicle()]] - code - app\actions\fleet.ts
- [[delivery-form.tsx]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[delivery-notifications.ts]] - code - lib\delivery-notifications.ts
- [[delivery.ts]] - code - app\actions\delivery.ts
- [[escapeHtml()_5]] - code - lib\delivery-notifications.ts
- [[fleet.ts]] - code - app\actions\fleet.ts
- [[formatDate()_25]] - code - lib\delivery-notifications.ts
- [[formatQuantity()_2]] - code - lib\delivery-notifications.ts
- [[generateDeliveryNumber()]] - code - app\actions\delivery.ts
- [[getDeliveries()]] - code - app\actions\delivery.ts
- [[getDelivery()]] - code - app\actions\delivery.ts
- [[getDeliveryItemsFlat()]] - code - app\actions\delivery.ts
- [[getDoMonitoringDeliveries()]] - code - app\actions\delivery.ts
- [[getDoMonitoringDeliveryOptions()]] - code - app\actions\delivery.ts
- [[getDrivers()]] - code - app\actions\fleet.ts
- [[getFleetTrips()]] - code - app\actions\fleet-trips.ts
- [[getInternalTotal()]] - code - app\dashboard\logistics-costs\_components\logistics-cost-table.tsx
- [[getOriginWarehouseStock()]] - code - app\actions\delivery.ts
- [[getProductStockLabel()]] - code - app\actions\delivery.ts
- [[getReadyOutstandingSalesOrders()]] - code - app\actions\delivery.ts
- [[getSalesOrdersForDelivery()]] - code - app\actions\delivery.ts
- [[getStockBrand()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[getVehicles()]] - code - app\actions\fleet.ts
- [[handleClearCosts()]] - code - app\dashboard\logistics-costs\_components\logistics-cost-table.tsx
- [[handleCreateDriver()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[handleCreateVehicle()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[handlePreviewDelivery()]] - code - app\dashboard\summary-order\summary-order-client.tsx
- [[isConsignmentCategory()]] - code - app\actions\delivery.ts
- [[isPlainObject()]] - code - lib\formatters.ts
- [[isSameDeliveryItemComposition()]] - code - app\actions\delivery.ts
- [[isStaleServerActionError()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[isVhsConsignmentCategory()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[loadDeliveryNumber()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[loadFleet()]] - code - app\dashboard\deliveries\_components\delivery-form.tsx
- [[logistics-cost-table.tsx]] - code - app\dashboard\logistics-costs\_components\logistics-cost-table.tsx
- [[main()_121]] - code - scripts\test-delivery-costs.ts
- [[mergeDeliveryItemsByProduct()]] - code - app\actions\delivery.ts
- [[mergeDeliveryRows()]] - code - app\actions\delivery.ts
- [[normalizeDeliveryNumberKey()]] - code - app\actions\delivery.ts
- [[normalizeDeliveryOutput()]] - code - app\actions\delivery.ts
- [[normalizeDeliverySerialNumbers()]] - code - app\actions\delivery.ts
- [[normalizeSapDocumentFields()]] - code - lib\formatters.ts
- [[normalizeText()_4]] - code - lib\delivery-notifications.ts
- [[notifyCreatedDelivery()]] - code - app\actions\delivery.ts
- [[notifyDeliveredDeliveries()]] - code - app\actions\delivery.ts
- [[page.tsx_21]] - code - app\dashboard\cost-settlements\create\page.tsx
- [[page.tsx_30]] - code - app\dashboard\deliveries\create\page.tsx
- [[page.tsx_29]] - code - app\dashboard\deliveries\page.tsx
- [[page.tsx_35]] - code - app\dashboard\do-monitoring\page.tsx
- [[page.tsx_40]] - code - app\dashboard\fleet-management\create\page.tsx
- [[page.tsx_39]] - code - app\dashboard\fleet-management\page.tsx
- [[page.tsx_123]] - code - app\dashboard\test-delivery-page\page.tsx
- [[resolveOrderItem()]] - code - lib\delivery-notifications.ts
- [[sendDeliveryCreatedNotification()]] - code - lib\delivery-notifications.ts
- [[sendDeliveryDeliveredNotification()]] - code - lib\delivery-notifications.ts
- [[sendSalesOrderCreatedNotification()]] - code - lib\delivery-notifications.ts
- [[syncDeliveryTypesForSO()]] - code - app\actions\delivery.ts
- [[test-delivery-costs.ts]] - code - scripts\test-delivery-costs.ts
- [[test-so-automation.ts]] - code - scripts\test-so-automation.ts
- [[testAutomation()]] - code - scripts\test-so-automation.ts
- [[toTitleCase()_1]] - code - lib\delivery-notifications.ts
- [[updateDelivery()]] - code - app\actions\delivery.ts
- [[updateDeliveryDate()]] - code - app\actions\delivery.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/createDelivery()
SORT file.name ASC
```

## Connections to other communities
- 9 edges to [[_COMMUNITY_getAuthenticatedSession()]]
- 5 edges to [[_COMMUNITY_uploadFile()]]
- 5 edges to [[_COMMUNITY_getWarehouses()]]
- 4 edges to [[_COMMUNITY_checkPermission()]]
- 3 edges to [[_COMMUNITY_normalizeCodeValue()]]
- 3 edges to [[_COMMUNITY_createSalesOrder()]]
- 3 edges to [[_COMMUNITY_sendSystemTemplatedEmailByCode()]]
- 2 edges to [[_COMMUNITY_isStockBookingSchemaAvailable()]]
- 1 edge to [[_COMMUNITY_createStockTransfer()]]
- 1 edge to [[_COMMUNITY_getSettlementSession()]]
- 1 edge to [[_COMMUNITY_Boolean()]]
- 1 edge to [[_COMMUNITY_getSafetyStockAnalytics()]]

## Top bridge nodes
- [[delivery.ts]] - degree 37, connects to 3 communities
- [[createDelivery()]] - degree 8, connects to 2 communities
- [[sendDeliveryDeliveredNotification()]] - degree 8, connects to 2 communities
- [[sendDeliveryCreatedNotification()]] - degree 7, connects to 2 communities
- [[sendSalesOrderCreatedNotification()]] - degree 7, connects to 2 communities