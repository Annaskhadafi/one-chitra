import * as React from "react"
import { Check, PlusCircle } from "lucide-react"
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

interface DataTableFacetedFilterProps {
    title?: string
    options: string[]
    selectedValues: string[]
    onFilterChange: (values: string[]) => void
    icon?: React.ReactNode
    formatOption?: (value: string) => string
    searchPlaceholder?: string
    triggerClassName?: string
    badgeClassName?: string
    contentClassName?: string
}

export function DataTableFacetedFilter({
    title,
    options,
    selectedValues,
    onFilterChange,
    icon,
    formatOption,
    searchPlaceholder,
    triggerClassName,
    badgeClassName,
    contentClassName,
}: DataTableFacetedFilterProps) {
    const selectedValuesSet = new Set(selectedValues)

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-[36px] border-dashed", triggerClassName)}
                >
                    {icon ?? <PlusCircle className="mr-2 h-4 w-4" />}
                    {title}
                    {selectedValuesSet.size > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <Badge
                                variant="secondary"
                                className={cn("rounded-sm px-1 font-normal lg:hidden", badgeClassName)}
                            >
                                {selectedValuesSet.size}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex items-center">
                                {selectedValuesSet.size > 2 ? (
                                    <Badge
                                        variant="secondary"
                                        className={cn("rounded-sm px-1 font-normal", badgeClassName)}
                                    >
                                        {selectedValuesSet.size} selected
                                    </Badge>
                                ) : (
                                    options
                                        .filter((option) => selectedValuesSet.has(option))
                                        .map((option) => (
                                            <Badge
                                                variant="secondary"
                                                key={option}
                                                className={cn("rounded-sm px-1 font-normal max-w-[120px] truncate", badgeClassName)}
                                            >
                                                {formatOption ? formatOption(option) : option}
                                            </Badge>
                                        ))
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-[300px] p-0", contentClassName)} align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder ?? title} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedValuesSet.has(option)
                                return (
                                    <CommandItem
                                        key={option}
                                        onSelect={() => {
                                            if (isSelected) {
                                                selectedValuesSet.delete(option)
                                            } else {
                                                selectedValuesSet.add(option)
                                            }
                                            const filterValues = Array.from(selectedValuesSet)
                                            onFilterChange(filterValues)
                                        }}
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{formatOption ? formatOption(option) : option}</span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                        {selectedValuesSet.size > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => onFilterChange([])}
                                        className="justify-center text-center font-medium"
                                    >
                                        Clear filters
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
