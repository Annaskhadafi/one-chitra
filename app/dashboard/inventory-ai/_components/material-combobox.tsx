"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { searchMaterials } from "@/app/actions/inventory-ai"
import { useDebounce } from "@/hooks/use-debounce"

export function MaterialCombobox({
    value,
    onChange
}: {
    value: string,
    onChange: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const [materials, setMaterials] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState(false)

    const debouncedSearch = useDebounce(search, 300)

    React.useEffect(() => {
        const fetchMaterials = async () => {
            if (debouncedSearch.length < 2) {
                setMaterials([])
                return
            }
            setIsLoading(true)
            const res = await searchMaterials(debouncedSearch)
            if (res.success && res.data) {
                setMaterials(res.data)
            }
            setIsLoading(false)
        }

        fetchMaterials()
    }, [debouncedSearch])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value
                        ? materials.find((mat) => mat.materialNo === value)?.materialNo || value
                        : "Pilih Material Number..."}
                    {isLoading ? (
                        <Loader2 className="ml-2 h-4 w-4 shrink-0 opacity-50 animate-spin" />
                    ) : (
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Cari material number atau deskripsi..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {isLoading ? "Mencari..." : search.length < 2 ? "Ketik minimal 2 karakter..." : "Material tidak ditemukan."}
                        </CommandEmpty>
                        <CommandGroup>
                            {materials.map((mat) => (
                                <CommandItem
                                    key={mat.materialNo}
                                    value={mat.materialNo}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue === value ? "" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === mat.materialNo ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{mat.materialNo}</span>
                                        <span className="text-xs text-muted-foreground">{mat.materialDesc}</span>
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
