"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TabShellProps = {
  defaultTab: string
  pendingCount: number
  inboxContent: React.ReactNode
  statusContent: React.ReactNode
  reportsContent: React.ReactNode
}

export function TabShell({
  defaultTab,
  pendingCount,
  inboxContent,
  statusContent,
  reportsContent,
}: TabShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", value)
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="inbox" className="gap-2">
          Inbox
          {pendingCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="status">Status</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>

      <TabsContent value="inbox">{inboxContent}</TabsContent>
      <TabsContent value="status">{statusContent}</TabsContent>
      <TabsContent value="reports">{reportsContent}</TabsContent>
    </Tabs>
  )
}
