"use client"

import * as React from "react"
import { Check, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

interface MultiSelectFilterProps {
  title: string
  options: string[]
  selectedValues: string[]
  onFilterChange: (values: string[]) => void
  icon?: React.ReactNode
  searchPlaceholder?: string
  maxBadgesShown?: number
}

export function MultiSelectFilter({
  title,
  options,
  selectedValues,
  onFilterChange,
  icon,
  searchPlaceholder,
  maxBadgesShown = 2,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false)
  const selectedValuesSet = React.useMemo(() => new Set(selectedValues), [selectedValues])

  const handleSelect = (option: string) => {
    const next = new Set(selectedValuesSet)
    if (next.has(option)) {
      next.delete(option)
    } else {
      next.add(option)
    }
    onFilterChange(Array.from(next))
  }

  const handleSelectAll = () => {
    onFilterChange(options)
  }

  const handleClearAll = () => {
    onFilterChange([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 border border-input bg-background px-3 hover:bg-accent hover:text-accent-foreground text-xs font-bold gap-2 flex items-center"
        >
          {icon ?? <Filter className="h-3.5 w-3.5 text-muted-foreground" />}
          <span>{title}</span>
          {selectedValuesSet.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1.5 h-4 bg-muted-foreground/30" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-extrabold text-[10px] bg-primary/10 text-primary border-none"
              >
                {selectedValuesSet.size}
              </Badge>
              <div className="hidden md:flex space-x-1 items-center">
                {selectedValuesSet.size > maxBadgesShown ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-bold text-[10px] bg-muted text-muted-foreground border-none"
                  >
                    +{selectedValuesSet.size - maxBadgesShown} lainnya
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValuesSet.has(option))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option}
                        className="rounded-sm px-1 font-bold text-[10px] max-w-[100px] truncate bg-muted text-muted-foreground border-none"
                      >
                        {option}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? `Cari ${title}...`} />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Tidak ada hasil.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={selectedValuesSet.size === options.length ? handleClearAll : handleSelectAll}
                className="justify-center text-center font-bold text-xs text-primary"
              >
                {selectedValuesSet.size === options.length ? "Hapus Semua Pilihan" : "Pilih Semua"}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValuesSet.has(option)
                return (
                  <CommandItem
                    key={option}
                    onSelect={() => handleSelect(option)}
                    className="text-xs font-semibold"
                  >
                    <div
                      className={cn(
                        "mr-2.5 flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "opacity-60 border-muted-foreground [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3px]" />
                    </div>
                    <span className="truncate">{option}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedValuesSet.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleClearAll}
                    className="justify-center text-center font-bold text-xs text-rose-500 hover:text-rose-600"
                  >
                    Reset Filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
