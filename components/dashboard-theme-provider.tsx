"use client"

import * as React from "react"
import { useTheme } from "@/components/theme-context"
import { SidebarProvider } from "@/components/ui/sidebar"
import type { NavbarTheme } from "@/lib/navbar-theme"

interface DashboardThemeProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
  navbarTheme: NavbarTheme
}

export function DashboardThemeProvider({
  children,
  defaultOpen,
  navbarTheme,
}: DashboardThemeProviderProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by waiting for mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // If not dark mode, apply custom theme from database
  // If dark mode or not mounted yet, use default system colors
  const isDark = mounted && resolvedTheme === "dark"

  const customStyle = isDark
    ? {
        "--sidebar-width": "calc(var(--spacing) * 72)",
      }
    : {
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--sidebar": navbarTheme.navbarBg,
        "--sidebar-foreground": navbarTheme.fontColor,
        "--sidebar-accent": navbarTheme.activeBg,
        "--sidebar-accent-foreground": "#ffffff",
        "--app-navbar-active-bg": navbarTheme.activeBg,
        "--app-navbar-section-color": navbarTheme.sectionColor,
      }

  return (
    <SidebarProvider defaultOpen={defaultOpen} style={customStyle as React.CSSProperties}>
      {children}
    </SidebarProvider>
  )
}
