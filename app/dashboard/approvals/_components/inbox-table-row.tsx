"use client"

import { useRouter } from "next/navigation"
import { TableRow } from "@/components/ui/table"

type InboxTableRowProps = {
  href: string
  children: React.ReactNode
}

export function InboxTableRow({ href, children }: InboxTableRowProps) {
  const router = useRouter()

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(href)}
    >
      {children}
    </TableRow>
  )
}
