"use client"

import { useEffect, useRef } from "react"
import { useOptionalSidebar } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * A utility component that automatically collapses the sidebar when rendered.
 * This is useful for pages with wide tables (e.g., Billing, Sales Orders)
 * to maximize horizontal screen space.
 * 
 * It only collapses the sidebar on desktop views.
 */
export function AutoCloseSidebar() {
  const sidebar = useOptionalSidebar()
  const isMobile = useIsMobile()
  const hasRun = useRef(false)

  useEffect(() => {
    if (!sidebar) {
      return
    }

    const { setOpen, state } = sidebar

    // Only auto-close on desktop and if it's currently open
    // We only want to do this ONCE when the component mounts
    if (!isMobile && state === "expanded" && !hasRun.current) {
      hasRun.current = true
      // Small timeout to allow the layout to settle before closing, avoiding hydration/flicker issues.
      setTimeout(() => {
          setOpen(false)
      }, 50)
    }
  }, [isMobile, sidebar])

  return null
}
