"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

export interface FilterState {
    dateRange: "7days" | "30days" | "custom"
    dateFrom?: Date
    dateTo?: Date
    materialGroup?: string
    stockRange?: "low" | "medium" | "high" | "all"
    accuracyLevel?: "high" | "medium" | "low" | "all"
    searchQuery: string
}

interface FilterContextType {
    filters: FilterState
    setFilters: (filters: FilterState) => void
    resetFilters: () => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

const STORAGE_KEY = "inventory-ml-filters"

const getDefaultFilters = (): FilterState => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)

    return {
        dateRange: "30days",
        dateFrom: thirtyDaysAgo,
        dateTo: now,
        materialGroup: undefined,
        stockRange: "all",
        accuracyLevel: "all",
        searchQuery: ""
    }
}

const loadFiltersFromStorage = (): FilterState => {
    if (typeof window === "undefined") {
        return getDefaultFilters()
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) {
            return getDefaultFilters()
        }

        const parsed = JSON.parse(stored)

        // Convert date strings back to Date objects
        if (parsed.dateFrom) {
            parsed.dateFrom = new Date(parsed.dateFrom)
        }
        if (parsed.dateTo) {
            parsed.dateTo = new Date(parsed.dateTo)
        }

        return {
            ...getDefaultFilters(),
            ...parsed
        }
    } catch (error) {
        console.error("Failed to load filters from localStorage:", error)
        return getDefaultFilters()
    }
}

const saveFiltersToStorage = (filters: FilterState): void => {
    if (typeof window === "undefined") {
        return
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch (error) {
        console.error("Failed to save filters to localStorage:", error)
    }
}

interface FilterProviderProps {
    children: ReactNode
}

export function FilterProvider({ children }: FilterProviderProps) {
    const [filters, setFiltersState] = useState<FilterState>(getDefaultFilters)
    const [isInitialized, setIsInitialized] = useState(false)

    // Load filters from localStorage on mount
    useEffect(() => {
        const loadedFilters = loadFiltersFromStorage()
        setFiltersState(loadedFilters)
        setIsInitialized(true)
    }, [])

    // Save filters to localStorage whenever they change (after initialization)
    useEffect(() => {
        if (isInitialized) {
            saveFiltersToStorage(filters)
        }
    }, [filters, isInitialized])

    const setFilters = (newFilters: FilterState) => {
        setFiltersState(newFilters)
    }

    const resetFilters = () => {
        const defaultFilters = getDefaultFilters()
        setFiltersState(defaultFilters)
    }

    return (
        <FilterContext.Provider value={{ filters, setFilters, resetFilters }}>
            {children}
        </FilterContext.Provider>
    )
}

export function useFilters() {
    const context = useContext(FilterContext)
    if (context === undefined) {
        throw new Error("useFilters must be used within a FilterProvider")
    }
    return context
}
