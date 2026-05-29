export type TopCustomerItem = {
  materialNo: string | null
  materialDescription: string | null
  qty: number
  itemRevenue: number
  currentStock: number
  isReady: boolean
}

export type TopCustomer = {
  customerName: string | null
  totalRevenue: number
  topItems: TopCustomerItem[]
}

export type TopCustomerData = {
  customers: TopCustomer[]
  topProducts?: TopCustomerItem[]
  totalRevenueAll?: number
}

export type TopCustomerExportRow = {
  customerRank: number
  customerName: string
  customerTotalRevenue: number
  itemRank: number
  materialNo: string
  materialDescription: string
  qty: number
  itemRevenue: number
  currentStock: number
  stockStatus: string
}

export function getStockStatus(item: Pick<TopCustomerItem, "isReady" | "currentStock">) {
  if (item.isReady) return "Ready"
  if (item.currentStock > 0) return String(item.currentStock)
  return "Kosong"
}

export function buildTopCustomerExportRows(data: TopCustomerData): TopCustomerExportRow[] {
  return data.customers.flatMap((customer, customerIndex) =>
    customer.topItems.map((item, itemIndex) => ({
      customerRank: customerIndex + 1,
      customerName: customer.customerName || "-",
      customerTotalRevenue: customer.totalRevenue || 0,
      itemRank: itemIndex + 1,
      materialNo: item.materialNo || "-",
      materialDescription: item.materialDescription || "-",
      qty: item.qty || 0,
      itemRevenue: item.itemRevenue || 0,
      currentStock: item.currentStock || 0,
      stockStatus: getStockStatus(item),
    })),
  )
}

export function buildTopProductExportRows(data: TopCustomerData): TopCustomerExportRow[] {
  return (data.topProducts || []).map((item, itemIndex) => ({
    customerRank: 0,
    customerName: "All Top Customers",
    customerTotalRevenue: 0,
    itemRank: itemIndex + 1,
    materialNo: item.materialNo || "-",
    materialDescription: item.materialDescription || "-",
    qty: item.qty || 0,
    itemRevenue: item.itemRevenue || 0,
    currentStock: item.currentStock || 0,
    stockStatus: getStockStatus(item),
  }))
}

export function buildTopCustomerSummary(data: TopCustomerData) {
  const detailRows = buildTopCustomerExportRows(data)
  const totalTopProductRevenue = (data.topProducts || []).reduce((sum, item) => sum + (item.itemRevenue || 0), 0)
  const totalRevenueAll = data.totalRevenueAll || 0
  const totalTopCustomerRevenue = data.customers.reduce((sum, customer) => sum + (customer.totalRevenue || 0), 0)

  return {
    customerCount: data.customers.length,
    itemCount: detailRows.length,
    topProductCount: data.topProducts?.length || 0,
    totalRevenue: totalTopCustomerRevenue,
    totalRevenueAll,
    topCustomerContribution: totalRevenueAll > 0 ? (totalTopCustomerRevenue / totalRevenueAll) * 100 : 0,
    topProductRevenue: totalTopProductRevenue,
    topProductContribution: totalRevenueAll > 0 ? (totalTopProductRevenue / totalRevenueAll) * 100 : 0,
    totalQty: detailRows.reduce((sum, row) => sum + row.qty, 0),
    readyItemCount: detailRows.filter((row) => row.stockStatus === "Ready" || Number(row.stockStatus) > 0).length,
    emptyItemCount: detailRows.filter((row) => row.stockStatus === "Kosong").length,
  }
}

export function getContributionPercent(value: number, baseline: number) {
  if (!baseline) return 0
  return (value / baseline) * 100
}
