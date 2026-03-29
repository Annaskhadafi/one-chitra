import Link from "next/link"
import { ArrowRight, CalendarDays, CircleAlert, ClipboardList, PackageCheck, Truck } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDeliveryPlanningBoardData, type DeliveryPlanningCard } from "@/app/actions/scm-sales-enhancements"

export const dynamic = "force-dynamic"

type DeliveryPlanningPageProps = {
  searchParams: Promise<{ date?: string }>
}

export default async function DeliveryPlanningBoardPage({ searchParams }: DeliveryPlanningPageProps) {
  const { date } = await searchParams
  const board = await getDeliveryPlanningBoardData(date)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Delivery Planning Board"
            subtitle="Halaman orkestrasi pengiriman harian yang menarik data dari Sales Order, Delivery, dan stok readiness yang sudah ada."
            icon={Truck}
          />
        </div>

        <Card className="w-full xl:w-[340px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Planning Filter</CardTitle>
            <CardDescription>Pilih tanggal kerja tanpa mengubah transaksi delivery yang sudah ada.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row xl:flex-col" method="get">
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                type="date"
                name="date"
                defaultValue={board.selectedDate}
              />
              <Button type="submit">Load Board</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Ready to Plan" value={board.summary.readyToPlan} tone="emerald" />
        <SummaryCard title="Partial Shipment" value={board.summary.partialShipment} tone="amber" />
        <SummaryCard title="Scheduled Today" value={board.summary.scheduledToday} tone="sky" />
        <SummaryCard title="On Delivery" value={board.summary.onDelivery} tone="violet" />
        <SummaryCard title="Delivered Today" value={board.summary.deliveredToday} tone="slate" />
        <SummaryCard title="Pending Issues" value={board.summary.pendingIssues} tone="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <BoardColumn
          title="Ready to Plan"
          description="Order outstanding dengan stok siap kirim."
          items={board.columns.readyToPlan}
          emptyText="Belum ada order yang full ready untuk dijadwalkan."
        />
        <BoardColumn
          title="Partial Shipment"
          description="Order atau delivery yang masih menyisakan item outstanding."
          items={board.columns.partialShipment}
          emptyText="Tidak ada shipment parsial yang perlu dipantau."
        />
        <BoardColumn
          title="Scheduled Today"
          description="Delivery yang sudah punya target berangkat hari ini."
          items={board.columns.scheduledToday}
          emptyText="Belum ada delivery yang dijadwalkan di tanggal ini."
        />
        <BoardColumn
          title="On Delivery"
          description="Armada yang sedang dalam perjalanan atau proses kirim."
          items={board.columns.onDelivery}
          emptyText="Tidak ada delivery in-transit saat ini."
        />
        <BoardColumn
          title="Pending Issues"
          description="Kendala stok, armada, atau dokumen yang butuh follow-up."
          items={board.columns.pendingIssues}
          emptyText="Tidak ada issue penting yang terbaca dari data existing."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivered Snapshot</CardTitle>
          <CardDescription>
            Ringkasan delivery yang selesai pada {new Date(`${board.selectedDate}T00:00:00`).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {board.deliveredToday.length === 0 ? (
            <EmptyBlock text="Belum ada delivery selesai di tanggal ini." />
          ) : (
            board.deliveredToday.map((item) => <DeliveryMiniCard key={item.id} item={item} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string
  value: number
  tone: "emerald" | "amber" | "sky" | "violet" | "slate" | "rose"
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  }

  return (
    <Card className={`${toneClasses[tone]} shadow-none`}>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em]">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{value.toLocaleString("id-ID")}</p>
        </div>
        <ClipboardList className="h-5 w-5 opacity-70" />
      </CardContent>
    </Card>
  )
}

function BoardColumn({
  title,
  description,
  items,
  emptyText,
}: {
  title: string
  description: string
  items: DeliveryPlanningCard[]
  emptyText: string
}) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <EmptyBlock text={emptyText} /> : items.map((item) => <BoardItemCard key={item.id} item={item} />)}
      </CardContent>
    </Card>
  )
}

function BoardItemCard({ item }: { item: DeliveryPlanningCard }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={documentVariant(item.documentStatus)}>{item.documentStatus} docs</Badge>
        <Badge variant="outline">{item.fulfillmentLabel}</Badge>
        {item.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="max-w-full truncate">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item.customerName}</span>
        </div>
        <div className="flex gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item.scheduleLabel}</span>
        </div>
        <div className="flex gap-2">
          <Truck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item.vehicleLabel}</span>
        </div>
        <div className="flex gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item.routeLabel}</span>
        </div>
        {item.note ? (
          <div className="flex gap-2">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{item.note}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <Link href={item.href}>
          <Button variant="outline" className="w-full justify-between">
            Open source page
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function DeliveryMiniCard({ item }: { item: DeliveryPlanningCard }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.customerName}</p>
        </div>
        <Badge variant={documentVariant(item.documentStatus)}>{item.documentStatus}</Badge>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{item.routeLabel}</p>
      <div className="mt-4">
        <Link href={item.href} className="text-sm font-medium text-primary hover:underline">
          Lihat delivery detail
        </Link>
      </div>
    </div>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function priorityVariant(priority: DeliveryPlanningCard["priority"]) {
  if (priority === "Critical") return "destructive"
  if (priority === "High") return "warning"
  return "secondary"
}

function documentVariant(status: DeliveryPlanningCard["documentStatus"]) {
  if (status === "Ready") return "success"
  if (status === "Partial") return "warning"
  return "destructive"
}
