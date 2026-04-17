"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DASHBOARD_SHORTCUTS_OPEN_EVENT } from "@/components/dashboard-shortcuts-command"
import { ThemeToggle } from "@/components/theme-toggle"
import { UtcClock } from "@/components/utc-clock"
import { NotificationBell } from "@/components/notification-bell"

export function SiteHeader() {
  const handleOpenShortcuts = () => {
    window.dispatchEvent(new Event(DASHBOARD_SHORTCUTS_OPEN_EVENT))
  }

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger
            className="-ml-1 bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90 hover:text-sidebar-accent-foreground rounded-md shadow-sm"
          />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-4 sm:block sm:mx-2"
          />
          <h1 className="text-base font-medium hidden sm:inline-block">All In One Apps Chitra Paratama</h1>
        </div>

        {/* Right Section: Jam UTC, Command Shortcut & Theme Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block">
            <UtcClock />
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenShortcuts} className="h-10 min-w-0 px-3 sm:px-4">
            Command
            <span className="ml-2 hidden rounded border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground sm:inline-flex">
              Ctrl+Q
            </span>
          </Button>
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

