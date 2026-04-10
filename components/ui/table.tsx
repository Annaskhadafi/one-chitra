"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

type TableHeadProps = React.ComponentProps<"th"> & {
  sortable?: boolean
  sorted?: false | "asc" | "desc"
  onSort?: (event?: unknown) => void
  showSortIndicator?: boolean
}

function TableHead({
  className,
  children,
  sortable = false,
  sorted = false,
  onSort,
  showSortIndicator = false,
  onClick,
  onKeyDown,
  ...props
}: TableHeadProps) {
  const isRightAligned = className?.includes("text-right") ?? false
  const isCenterAligned = className?.includes("text-center") ?? false

  const handleSort = () => {
    if (!sortable || !onSort) {
      return
    }

    onSort(undefined)
  }

  const handleClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      !sortable ||
      !onSort ||
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, [role='button']"
      )
    ) {
      return
    }

    handleSort()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    onKeyDown?.(event)

    if (
      event.defaultPrevented ||
      !sortable ||
      !onSort ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return
    }

    event.preventDefault()
    handleSort()
  }

  const sortIndicator = !showSortIndicator ? null : sorted === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 shrink-0" />
  ) : sorted === "desc" ? (
    <ArrowDown className="h-3.5 w-3.5 shrink-0" />
  ) : (
    <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
  )

  return (
    <th
      data-slot="table-head"
      data-sortable={sortable || undefined}
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : sortable
              ? "none"
              : undefined
      }
      role={sortable ? "button" : undefined}
      tabIndex={sortable ? 0 : undefined}
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        sortable && "cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onClick={sortable ? handleClick : onClick}
      onKeyDown={sortable ? handleKeyDown : onKeyDown}
      {...props}
    >
      {showSortIndicator ? (
        <div
          className={cn(
            "flex items-center gap-1",
            isRightAligned
              ? "justify-end"
              : isCenterAligned
                ? "justify-center"
                : "justify-start"
          )}
        >
          {children}
          {sortIndicator}
        </div>
      ) : (
        children
      )}
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
