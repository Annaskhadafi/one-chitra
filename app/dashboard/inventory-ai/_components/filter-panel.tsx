"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { 
    Filter, 
    X, 
    Search, 
    Calendar as CalendarIcon,
    Package,
    Target,
    TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export interface FilterState {
    dateRange: "7days" | "30days" | "custom"
    dateFrom?: Date
    dateTo?: Date
    materialGroup?: string
    stockRange?: "low" | "medium" | "high" | "all"
    accuracyLevel?: "high" | "medium" | "low" | "all"
    searchQuery: string
}

interface FilterPanelProps {
    filters: FilterState
    onFiltersChange: (filters: FilterState) => void
    resultCount?: number
    availableMaterialGroups?: Array<{ id: string; name: string }>
    showAccuracyFilter?: boolean
}

export function FilterPanel({
    filters,
    onFiltersChange,
    resultCount,
    availableMaterialGroups = [],
    showAccuracyFilter = true
}: FilterPanelProps) {
    const [searchInput, setSearchInput] = useState(filters.searchQuery)
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)

    // Debounce search input (400ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== filters.searchQuery) {
                onFiltersChange({ ...filters, searchQuery: searchInput })
            }
        }, 400)

        return () => clearTimeout(timer)
    }, [searchInput])

    const handleDateRangeChange = (range: "7days" | "30days" | "custom") => {
        const now = new Date()
        let dateFrom: Date | undefined
        let dateTo: Date | undefined

        if (range === "7days") {
            dateFrom = new Date(now.setDate(now.getDate() - 7))
            dateTo = new Date()
        } else if (range === "30days") {
            dateFrom = new Date(now.setDate(now.getDate() - 30))
            dateTo = new Date()
        }

        onFiltersChange({
            ...filters,
            dateRange: range,
            dateFrom,
            dateTo
        })
    }

    const handleCustomDateChange = (type: "from" | "to", date: Date | undefined) => {
        onFiltersChange({
            ...filters,
            dateRange: "custom",
            [type === "from" ? "dateFrom" : "dateTo"]: date
        })
    }

    const handleClearFilters = () => {
        setSearchInput("")
        onFiltersChange({
            dateRange: "30days",
            dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)),
            dateTo: new Date(),
            materialGroup: undefined,
            stockRange: "all",
            accuracyLevel: "all",
            searchQuery: ""
        })
    }

    const hasActiveFilters = 
        filters.searchQuery !== "" ||
        filters.materialGroup !== undefined ||
        filters.stockRange !== "all" ||
        filters.accuracyLevel !== "all"

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5 text-primary" />
                            Filters
                        </CardTitle>
                        <CardDescription>
                            Filter and search predictions
                            {resultCount !== undefined && (
                                <span className="ml-2 font-medium text-foreground">
                                    ({resultCount} results)
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearFilters}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Clear All
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Search Box */}
                <div className="space-y-2">
                    <Label htmlFor="search" className="text-sm font-medium">
                        Search
                    </Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="search"
                            placeholder="Search by Material Number or Product Name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Date Range Selector */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Date Range
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={filters.dateRange === "7days" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleDateRangeChange("7days")}
                        >
                            Last 7 Days
                        </Button>
                        <Button
                            variant={filters.dateRange === "30days" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleDateRangeChange("30days")}
                        >
                            Last 30 Days
                        </Button>
                        <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={filters.dateRange === "custom" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        if (filters.dateRange !== "custom") {
                                            onFiltersChange({ ...filters, dateRange: "custom" })
                                        }
                                    }}
                                >
                                    Custom Range
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">From Date</Label>
                                        <Calendar
                                            mode="single"
                                            selected={filters.dateFrom}
                                            onSelect={(date) => handleCustomDateChange("from", date)}
                                            disabled={(date) =>
                                                date > new Date() || (filters.dateTo ? date > filters.dateTo : false)
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">To Date</Label>
                                        <Calendar
                                            mode="single"
                                            selected={filters.dateTo}
                                            onSelect={(date) => handleCustomDateChange("to", date)}
                                            disabled={(date) =>
                                                date > new Date() || (filters.dateFrom ? date < filters.dateFrom : false)
                                            }
                                        />
                                    </div>
                                    {filters.dateFrom && filters.dateTo && (
                                        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                                            {format(filters.dateFrom, "MMM dd, yyyy")} - {format(filters.dateTo, "MMM dd, yyyy")}
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Material Group Filter */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Material Group
                        </Label>
                        <Select
                            value={filters.materialGroup || "all"}
                            onValueChange={(value) =>
                                onFiltersChange({
                                    ...filters,
                                    materialGroup: value === "all" ? undefined : value
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Groups" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Groups</SelectItem>
                                {availableMaterialGroups.map((group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                        {group.name || group.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Stock Range Filter */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Stock Range
                        </Label>
                        <Select
                            value={filters.stockRange || "all"}
                            onValueChange={(value) =>
                                onFiltersChange({
                                    ...filters,
                                    stockRange: value as FilterState["stockRange"]
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Ranges" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Ranges</SelectItem>
                                <SelectItem value="low">Low (&lt;100)</SelectItem>
                                <SelectItem value="medium">Medium (100-500)</SelectItem>
                                <SelectItem value="high">High (&gt;500)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Accuracy Level Filter */}
                    {showAccuracyFilter && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                Accuracy Level
                            </Label>
                            <Select
                                value={filters.accuracyLevel || "all"}
                                onValueChange={(value) =>
                                    onFiltersChange({
                                        ...filters,
                                        accuracyLevel: value as FilterState["accuracyLevel"]
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Levels" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Levels</SelectItem>
                                    <SelectItem value="high">High (&gt;80%)</SelectItem>
                                    <SelectItem value="medium">Medium (60-80%)</SelectItem>
                                    <SelectItem value="low">Low (&lt;60%)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
