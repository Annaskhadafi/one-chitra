"use client"

import { Bell, CheckCircle2, ClipboardList, UserCog } from "lucide-react"

import type { UIStepType } from "@/app/dashboard/approvals/_lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type StepTypeSelectorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: UIStepType) => void
}

const stepTypeOptions: {
  type: UIStepType
  title: string
  description: string
  icon: React.ReactNode
  iconBg: string
}[] = [
  {
    type: "approval",
    title: "Approval",
    description: "Langkah persetujuan oleh approver yang ditentukan",
    icon: <CheckCircle2 className="h-6 w-6 text-green-600" />,
    iconBg: "bg-green-50",
  },
  {
    type: "notification",
    title: "Notification",
    description: "Kirim notifikasi ke penerima tertentu",
    icon: <Bell className="h-6 w-6 text-purple-600" />,
    iconBg: "bg-purple-50",
  },
  {
    type: "update_user",
    title: "Update User",
    description: "Perbarui field data pengguna secara otomatis",
    icon: <UserCog className="h-6 w-6 text-orange-600" />,
    iconBg: "bg-orange-50",
  },
  {
    type: "user_input",
    title: "User Input",
    description: "Minta input tambahan dari pengguna",
    icon: <ClipboardList className="h-6 w-6 text-blue-600" />,
    iconBg: "bg-blue-50",
  },
]

export function StepTypeSelector({ open, onOpenChange, onSelect }: StepTypeSelectorProps) {
  function handleSelect(type: UIStepType) {
    onSelect(type)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pilih Tipe Step</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 pt-2">
          {stepTypeOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => handleSelect(option.type)}
              className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${option.iconBg}`}>
                {option.icon}
              </div>
              <div>
                <p className="font-medium">{option.title}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
