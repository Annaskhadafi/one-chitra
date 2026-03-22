"use client"

import { sortTimelineEntries } from "@/app/dashboard/approvals/_lib/utils"
import type { TimelineEntry } from "@/app/dashboard/approvals/_lib/types"

const ACTION_LABELS: Record<TimelineEntry["action"], string> = {
  submitted: "Diajukan",
  approved: "Disetujui",
  rejected: "Ditolak",
  reverted: "Dibatalkan",
  commented: "Komentar",
  escalate: "Eskalasi",
  cancel: "Dibatalkan",
}

const DOT_COLORS: Record<TimelineEntry["action"], string> = {
  submitted: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  reverted: "bg-orange-500",
  commented: "bg-gray-400",
  escalate: "bg-purple-500",
  cancel: "bg-gray-400",
}

interface TimelineProps {
  entries: TimelineEntry[]
}

export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
  }

  const sorted = sortTimelineEntries(entries)

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

      {sorted.map((entry, index) => (
        <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Dot */}
          <div className={`relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full ${DOT_COLORS[entry.action]}`} />

          {/* Content */}
          <div className="flex-1 space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">{entry.actorName}</span>
              <span className="text-sm text-muted-foreground">{ACTION_LABELS[entry.action]}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString("id-ID")}
            </p>
            {entry.comment && (
              <p className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">{entry.comment}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
