"use client"

import { useQuery } from "@tanstack/react-query"
import { searchMaterials, searchCustomers } from "@/app/actions/inventory-ai"

/**
 * Hook for searching materials with 1-hour cache
 * Requirements: 10.3 - Cache SAP queries for 1 hour
 */
export function useMaterialSearch(query: string) {
    return useQuery({
        queryKey: ["sap-materials", query],
        queryFn: async () => {
            if (!query || query.length < 2) {
                return { success: true, data: [] }
            }
            return searchMaterials(query)
        },
        staleTime: 60 * 60 * 1000, // 1 hour (3600000ms)
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
        enabled: query.length >= 2, // Only run query if search term is at least 2 characters
    })
}

/**
 * Hook for searching customers with 1-hour cache
 * Requirements: 10.3 - Cache SAP queries for 1 hour
 */
export function useCustomerSearch(query: string) {
    return useQuery({
        queryKey: ["sap-customers", query],
        queryFn: async () => {
            if (!query || query.length < 2) {
                return { success: true, data: [] }
            }
            return searchCustomers(query)
        },
        staleTime: 60 * 60 * 1000, // 1 hour (3600000ms)
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
        enabled: query.length >= 2, // Only run query if search term is at least 2 characters
    })
}
