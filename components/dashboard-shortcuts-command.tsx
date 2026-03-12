"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import type { RuntimeNavSection } from "@/lib/navigation-menu"

type ShortcutItem = {
  id: string
  title: string
  url: string
  sectionTitle: string
  parentTitle?: string
  openInNewTab?: boolean
}

interface DashboardShortcutsCommandProps {
  navigationSections: RuntimeNavSection[]
}

export function DashboardShortcutsCommand({
  navigationSections,
}: DashboardShortcutsCommandProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "q") {
        event.preventDefault()
        setOpen((prevOpen) => !prevOpen)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const shortcutsBySection = React.useMemo(() => {
    const sectionMap = new Map<string, ShortcutItem[]>()
    const seen = new Set<string>()

    const addItem = (item: ShortcutItem) => {
      const dedupeKey = `${item.title}-${item.url}-${item.sectionTitle}`
      if (seen.has(dedupeKey)) {
        return
      }

      seen.add(dedupeKey)

      if (!sectionMap.has(item.sectionTitle)) {
        sectionMap.set(item.sectionTitle, [])
      }

      sectionMap.get(item.sectionTitle)?.push(item)
    }

    navigationSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.url && item.url !== "#") {
          addItem({
            id: item.id,
            title: item.title,
            url: item.url,
            sectionTitle: section.title,
            openInNewTab: item.openInNewTab,
          })
        }

        item.items?.forEach((subItem) => {
          if (!subItem.url || subItem.url === "#") {
            return
          }

          addItem({
            id: subItem.id,
            title: subItem.title,
            url: subItem.url,
            sectionTitle: section.title,
            parentTitle: item.title,
            openInNewTab: subItem.openInNewTab,
          })
        })
      })
    })

    return Array.from(sectionMap.entries())
  }, [navigationSections])

  const handleSelect = React.useCallback(
    (url: string, openInNewTab?: boolean) => {
      setOpen(false)

      if (openInNewTab) {
        window.open(url, "_blank", "noopener,noreferrer")
        return
      }

      router.push(url)
    },
    [router],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Shortcut Menu"
      description="Cari dan buka menu dashboard dengan cepat"
    >
      <CommandInput placeholder="Cari menu..." />
      <CommandList>
        <CommandEmpty>Menu tidak ditemukan.</CommandEmpty>
        {shortcutsBySection.map(([sectionTitle, items]) => (
          <CommandGroup key={sectionTitle} heading={sectionTitle}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${item.parentTitle ?? ""} ${item.sectionTitle}`}
                onSelect={() => handleSelect(item.url, item.openInNewTab)}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{item.title}</span>
                  {item.parentTitle ? (
                    <span className="text-muted-foreground truncate text-xs">{item.parentTitle}</span>
                  ) : null}
                </div>
                <CommandShortcut>{item.openInNewTab ? "↗" : "↵"}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}