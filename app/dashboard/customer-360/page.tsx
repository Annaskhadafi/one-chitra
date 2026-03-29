import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CircleAlert, FileText, History, Package, ReceiptText, ShoppingCart, UserRound, type LucideIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCustomer360Data } from "@/app/actions/scm-sales-enhancements"
import { CustomerSelector } from "./_components/customer-selector"

export const dynamic = "force-dynamic"

type Customer360PageProps = {
  searchParams: Promise<{ customer?: string }>
}

export default async function Customer360WorkspacePage({ searchParams }: Customer360PageProps) {
  const { customer } = await searchParams
  const data = await getCustomer360Data(customer)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Customer 360 Workspace"
            subtitle="Halaman baru yang menggabungkan quotation, sales order, delivery, billing, histori order, dan sinyal reorder tanpa mengubah halaman existing."
            icon={UserRound}
          />
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50">
        <CardContent className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          {data.selectedCustomer ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Operational 360</Badge>
                <Badge variant="secondary">{data.selectedCustomer.customerCode}</Badge>
                <Badge variant="outline">{formatDateTime(data.overview.lastActivity)} last activity</Badge>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">{data.selectedCustomer.name}</h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Master customer, aktivitas penjualan, pengiriman, billing, dan sinyal reorder dalam satu workspace yang terintegrasi dengan modul existing.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <QuickInfo label="PIC" value={data.selectedCustomer.contactName || "-"} />
                <QuickInfo label="Email" value={data.selectedCustomer.email || "-"} />
                <QuickInfo label="Address" value={buildAddress(data.selectedCustomer)} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center">
              <div className="max-w-2xl space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Operational 360</Badge>
                  <Badge variant="secondary">Customer required</Badge>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Pilih customer untuk membuka workspace</h2>
                  <p className="text-sm text-muted-foreground">
                    Halaman ini sengaja dibuka dalam kondisi kosong dulu agar tim Sales atau SCM bisa memilih account yang ingin dianalisis tanpa auto-load customer pertama.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <QuickInfo label="Quotation" value="Lihat pipeline per customer" />
                  <QuickInfo label="Delivery" value="Monitor fulfillment & issue" />
                  <QuickInfo label="Reorder" value="Tangkap sinyal repeat order" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border bg-background/80 p-5 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Select Customer</p>
              <h3 className="mt-2 text-lg font-semibold">Buka workspace account</h3>
              <p className="mt-1 text-sm text-muted-foreground">Gunakan combobox untuk mencari customer code atau nama account.</p>
            </div>

            <CustomerSelector
              customers={data.customers.map((item) => ({
                id: item.id,
                customerCode: item.customerCode,
                name: item.name,
              }))}
              selectedCustomerId={data.selectedCustomer?.id}
            />

            {data.selectedCustomer ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <CompactStat
                  label="Billed Revenue"
                  value={formatCurrency(data.overview.billedRevenue)}
                  tone="emerald"
                />
                <CompactStat
                  label="Outstanding Invoice"
                  value={data.overview.outstandingInvoices.toLocaleString("id-ID")}
                  tone="amber"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Belum ada customer terpilih. Pilih salah satu account dari combobox untuk menampilkan data Customer 360.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!data.selectedCustomer ? (
        <EmptyPanel text="Silakan pilih customer terlebih dahulu untuk menampilkan histori order, quotation, pembayaran, produk favorit, dan potensi reorder." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Active Quotations" value={data.overview.activeQuotations.toLocaleString("id-ID")} icon={FileText} />
            <MetricCard title="Sales Orders" value={data.overview.salesOrders.toLocaleString("id-ID")} icon={ShoppingCart} />
            <MetricCard title="Deliveries" value={data.overview.deliveries.toLocaleString("id-ID")} icon={Package} />
            <MetricCard title="Last Activity" value={formatDateTime(data.overview.lastActivity)} icon={History} />
            <MetricCard title="Issues" value={data.issues.length.toLocaleString("id-ID")} icon={CircleAlert} />
            <MetricCard title="Reorder Signals" value={data.reorderSignals.length.toLocaleString("id-ID")} icon={ReceiptText} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.85fr)]">
            <div className="space-y-4">
              <RecordSection
                title="Quotation Pipeline"
                description="Mengambil data dari modul Quotations yang sudah ada."
                ctaHref="/dashboard/quotations"
                ctaLabel="Open quotations"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.quotations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada quotation untuk customer ini.</TableCell>
                      </TableRow>
                    ) : (
                      data.quotations.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link href={`/dashboard/quotations/${row.id}`} className="font-medium text-primary hover:underline">
                              {row.quotationNumber || `Quotation #${row.id}`}
                            </Link>
                          </TableCell>
                          <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                          <TableCell>{formatDate(row.validUntil)}</TableCell>
                          <TableCell>{row.totalItems.toLocaleString("id-ID")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </RecordSection>

              <RecordSection
                title="Sales Orders"
                description="Snapshot order aktif dan outstanding yang sudah dibuat di modul Sales Order."
                ctaHref="/dashboard/sales-orders"
                ctaLabel="Open sales orders"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SO</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Latest Delivery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.salesOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada sales order untuk customer ini.</TableCell>
                      </TableRow>
                    ) : (
                      data.salesOrders.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link href={`/dashboard/sales-orders/${row.id}/edit`} className="font-medium text-primary hover:underline">
                              {row.invoiceNumber || `SO #${row.id}`}
                            </Link>
                            <div className="text-xs text-muted-foreground">{row.customerPo || "-"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline">{row.status}</Badge>
                              {row.remarksLabel ? <span className="text-xs text-muted-foreground">{row.remarksLabel}</span> : null}
                            </div>
                          </TableCell>
                          <TableCell>{row.outstandingQty.toLocaleString("id-ID")}</TableCell>
                          <TableCell>{row.latestDeliveryNumber || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </RecordSection>

              <div className="grid gap-4 xl:grid-cols-2">
                <RecordSection
                  title="Delivery Snapshot"
                  description="Monitor fulfillment customer tanpa pindah ke modul delivery."
                  ctaHref="/dashboard/delivery-planning-board"
                  ctaLabel="Open delivery board"
                >
                  <MiniListCard title="Deliveries" rows={data.deliveries.map((row) => ({
                    primary: row.deliveryNumber || "-",
                    secondary: `${row.status} · ${row.vehicleLabel}`,
                    tertiary: `${formatDate(row.scheduledDate)} · ${row.routeLabel}`,
                    href: `/dashboard/deliveries/${row.id}/view`,
                    badge: row.documentStatus,
                  }))} emptyText="Belum ada delivery." />
                </RecordSection>

                <RecordSection
                  title="Billing Snapshot"
                  description="Ringkasan invoice dan status closing customer."
                  ctaHref="/dashboard/billing"
                  ctaLabel="Open billing"
                >
                  <MiniListCard title="Billing" rows={data.billings.map((row) => ({
                    primary: row.invoiceNumber || row.poNo || "-",
                    secondary: `${formatCurrency(row.totalPriceIdr)} · ${row.statusDelivery || "No status"}`,
                    tertiary: `${formatDate(row.invoiceDate)} · Receiver ${formatDate(row.receiverDate)}`,
                    href: "/dashboard/billing",
                    badge: row.receiverDate ? "Closed" : "Open",
                  }))} emptyText="Belum ada billing record." />
                </RecordSection>
              </div>
            </div>

            <div className="space-y-4">
              <RecordSection
                title="Issues & Follow-up"
                description="Menarik sinyal issue dari quotation, delivery, dan billing existing."
                ctaHref={data.selectedCustomer ? `/dashboard/reports/customers/360?customer=${encodeURIComponent(data.selectedCustomer.customerCode)}` : "/dashboard/reports/customers"}
                ctaLabel="Open analytics 360"
              >
                <div className="space-y-3">
                  {data.issues.length === 0 ? (
                    <EmptyPanel text="Tidak ada issue penting yang terbaca dari modul yang terhubung." />
                  ) : (
                    data.issues.map((item, index) => (
                      <div key={`${item.source}-${index}`} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                          </div>
                          <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{item.source}</span>
                          <Link href={item.href} className="font-medium text-primary hover:underline">
                            Open source
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </RecordSection>

              <RecordSection
                title="Favorite Products"
                description="Produk yang paling sering muncul dari transaksi lokal dan histori SAP."
              >
                <div className="space-y-3">
                  {data.favoriteProducts.length === 0 ? (
                    <EmptyPanel text="Belum ada produk favorit yang bisa dipetakan." />
                  ) : (
                    data.favoriteProducts.map((item, index) => (
                      <div key={`${item.materialNumber}-${index}`} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.materialNumber}</p>
                          </div>
                          <Badge variant="secondary">{item.source}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{item.quantity.toLocaleString("id-ID")} qty</span>
                          <span>{formatCurrency(item.revenue)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </RecordSection>

              <RecordSection
                title="Potential Reorder"
                description="Sinyal rule-based dari histori order agar sales bisa follow-up lebih cepat."
              >
                <div className="space-y-3">
                  {data.reorderSignals.length === 0 ? (
                    <EmptyPanel text="Belum ada sinyal reorder yang cukup kuat dari histori transaksi." />
                  ) : (
                    data.reorderSignals.map((item) => (
                      <div key={item.materialNumber} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.materialNumber}</p>
                          </div>
                          <Badge variant={item.confidence === "High" ? "success" : "warning"}>{item.confidence}</Badge>
                        </div>
                        <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                          <p>Last order: {formatDate(item.lastOrderDate)}</p>
                          <p>Days since last order: {item.daysSinceLastOrder ?? "-"} hari</p>
                          <p>Frequency: {item.orderCount.toLocaleString("id-ID")} transaksi</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </RecordSection>

              <RecordSection
                title="History Timeline"
                description="Cuplikan histori billing/order yang sudah ada di data SAP."
                ctaHref="/dashboard/history-order"
                ctaLabel="Open history order"
              >
                <div className="space-y-3">
                  {data.historyTimeline.length === 0 ? (
                    <EmptyPanel text="Belum ada histori order SAP untuk customer ini." />
                  ) : (
                    data.historyTimeline.map((item, index) => (
                      <div key={`${item.poNo}-${index}`} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.materialDescription || item.materialNumber || "Unknown Product"}</p>
                            <p className="text-xs text-muted-foreground">{item.materialNumber || "-"} · PO {item.poNo || "-"}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(item.billingDate)}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{item.qty.toLocaleString("id-ID")} qty</span>
                          <span>{formatCurrency(item.revenue)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </RecordSection>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/90 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}

function CompactStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "emerald" | "amber"
}) {
  const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function RecordSection({
  title,
  description,
  ctaHref,
  ctaLabel,
  children,
}: {
  title: string
  description: string
  ctaHref?: string
  ctaLabel?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {ctaHref && ctaLabel ? (
            <Link href={ctaHref}>
              <Button variant="outline" className="w-full sm:w-auto">
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function MiniListCard({
  title,
  rows,
  emptyText,
}: {
  title: string
  rows: Array<{
    primary: string
    secondary: string
    tertiary: string
    href: string
    badge: string
  }>
  emptyText: string
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <EmptyPanel text={emptyText} />
        ) : (
          rows.map((row, index) => (
            <div key={`${row.primary}-${index}`} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.primary}</p>
                  <p className="text-xs text-muted-foreground">{row.secondary}</p>
                </div>
                <Badge variant="outline">{row.badge}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.tertiary}</p>
              <Link href={row.href} className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">
                Open source
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

function buildAddress(customer: {
  address1: string | null
  address2: string | null
  address3: string | null
  address4: string | null
  address5: string | null
}) {
  return [customer.address1, customer.address2, customer.address3, customer.address4, customer.address5].filter(Boolean).join(", ") || "-"
}

function severityVariant(severity: "High" | "Medium" | "Low") {
  if (severity === "High") return "destructive"
  if (severity === "Medium") return "warning"
  return "secondary"
}
