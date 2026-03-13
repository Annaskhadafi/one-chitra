import type {
    getSalesOrder as GetSalesOrderFn,
    getSalesOrders as GetSalesOrdersFn,
} from "@/app/actions/sales-order"

export type SalesOrderListItem = Awaited<ReturnType<typeof GetSalesOrdersFn>>[number]

type SalesOrderDetailRecord = NonNullable<Awaited<ReturnType<typeof GetSalesOrderFn>>>

export type ProformaInvoiceOrder = Pick<
    SalesOrderDetailRecord,
    "invoiceNumber" | "customerPo" | "salesDate" | "discount" | "shipping" | "items" | "customer"
>
