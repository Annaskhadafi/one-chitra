"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type CustomerOption = {
  id: number
  customerCode: string
  name: string
}

export function CustomerSelector({
  customers,
  selectedCustomerId,
}: {
  customers: CustomerOption[]
  selectedCustomerId?: number | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  )

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return customers
    }

    return customers.filter((customer) =>
      `${customer.customerCode} ${customer.name}`.toLowerCase().includes(normalizedQuery),
    )
  }, [customers, query])

  const handleSelect = (customerId: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("customer", String(customerId))
    setQuery("")
    setOpen(false)
    router.push(`/dashboard/customer-360?${params.toString()}`)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full justify-between overflow-hidden px-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              {selectedCustomer ? (
                <div className="truncate">
                  <span className="font-medium">{selectedCustomer.customerCode}</span>
                  <span className="text-muted-foreground"> - {selectedCustomer.name}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">Pilih customer...</span>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Cari customer code atau nama..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Customer tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.customerCode} ${customer.name}`}
                  keywords={[customer.customerCode, customer.name]}
                  onSelect={() => handleSelect(customer.id)}
                  className="flex items-start gap-3 py-3"
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      selectedCustomerId === customer.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{customer.customerCode}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
