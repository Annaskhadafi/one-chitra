"use client"

import { useEffect, useState, useTransition } from "react"
import { getApprovalReports } from "@/app/actions/approval"
import type { ApprovalReportsData } from "@/app/dashboard/approvals/_lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STAT_CARDS = [
  {
    key: "pending",
    label: "Pending",
    className: "border-yellow-200 bg-yellow-50",
    titleClass: "text-yellow-700",
    valueClass: "text-yellow-800",
  },
  {
    key: "approved",
    label: "Approved",
    className: "border-green-200 bg-green-50",
    titleClass: "text-green-700",
    valueClass: "text-green-800",
  },
  {
    key: "rejected",
    label: "Rejected",
    className: "border-red-200 bg-red-50",
    titleClass: "text-red-700",
    valueClass: "text-red-800",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    className: "border-gray-200 bg-gray-50",
    titleClass: "text-gray-600",
    valueClass: "text-gray-700",
  },
] as const

export function ReportsTab() {
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [data, setData] = useState<ApprovalReportsData | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getApprovalReports({
        from: dateFrom || null,
        to: dateTo || null,
      })
      setData(result)
    })
  }, [dateFrom, dateTo])

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Dari</label>
          <Input
            type="date"
            className="w-36"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sampai</label>
          <Input
            type="date"
            className="w-36"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
          Memuat data...
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STAT_CARDS.map((card) => (
              <Card key={card.key} className={card.className}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm font-medium ${card.titleClass}`}>
                    {card.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${card.valueClass}`}>
                    {data?.byStatus[card.key] ?? 0}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Avg completion days */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rata-rata Waktu Penyelesaian
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.avgCompletionDays != null ? (
                <p className="text-3xl font-bold">
                  {data.avgCompletionDays.toFixed(1)}{" "}
                  <span className="text-base font-normal text-muted-foreground">hari</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada data penyelesaian.</p>
              )}
            </CardContent>
          </Card>

          {/* Step bottlenecks table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step Bottlenecks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!data || data.stepBottlenecks.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Tidak ada data bottleneck.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead className="w-[120px]">Step Order</TableHead>
                      <TableHead className="w-[140px] text-right">Pending Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.stepBottlenecks.map((row) => (
                      <TableRow
                        key={`${row.stepName}-${row.stepOrder}`}
                      >
                        <TableCell className="font-medium">{row.stepName}</TableCell>
                        <TableCell className="text-muted-foreground">#{row.stepOrder}</TableCell>
                        <TableCell className="text-right font-semibold">{row.pendingCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
