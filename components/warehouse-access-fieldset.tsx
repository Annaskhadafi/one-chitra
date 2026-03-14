"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export type WarehouseAccessSelection = {
    warehouseId: number
    accessLevel: "view" | "edit"
}

export type WarehouseOption = {
    id: number
    sloc: string
    description?: string | null
    type?: string | null
}

type WarehouseAccessFieldsetProps = {
    warehouses: WarehouseOption[]
    value: WarehouseAccessSelection[]
    onChange: (nextValue: WarehouseAccessSelection[]) => void
    disabled?: boolean
    hint?: string
}

function getWarehouseLabel(warehouse: WarehouseOption) {
    return warehouse.description ? `${warehouse.sloc} - ${warehouse.description}` : warehouse.sloc
}

export function WarehouseAccessFieldset({
    warehouses,
    value,
    onChange,
    disabled = false,
    hint = "Kosongkan jika user masih perlu akses semua warehouse. Pilih warehouse jika ingin dibatasi per site.",
}: WarehouseAccessFieldsetProps) {
    const valueMap = new Map(value.map((entry) => [entry.warehouseId, entry.accessLevel]))

    function handleToggle(warehouseId: number, checked: boolean) {
        if (checked) {
            if (valueMap.has(warehouseId)) {
                return
            }

            onChange([
                ...value,
                {
                    warehouseId,
                    accessLevel: "edit",
                },
            ])
            return
        }

        onChange(value.filter((entry) => entry.warehouseId !== warehouseId))
    }

    function handleAccessLevelChange(warehouseId: number, accessLevel: "view" | "edit") {
        onChange(
            value.map((entry) => (
                entry.warehouseId === warehouseId
                    ? { ...entry, accessLevel }
                    : entry
            ))
        )
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label>Warehouse Access</Label>
                <p className="text-xs text-muted-foreground">{hint}</p>
            </div>

            <div className="max-h-56 space-y-2 overflow-auto rounded-md border p-3">
                {warehouses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Warehouse belum tersedia.</p>
                ) : (
                    warehouses.map((warehouse) => {
                        const accessLevel = valueMap.get(warehouse.id)
                        const isSelected = Boolean(accessLevel)

                        return (
                            <div
                                key={warehouse.id}
                                className="grid gap-2 rounded-md border border-dashed p-3 md:grid-cols-[1fr_140px]"
                            >
                                <label className="flex items-start gap-3">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => handleToggle(warehouse.id, Boolean(checked))}
                                        disabled={disabled}
                                    />
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium">{getWarehouseLabel(warehouse)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {warehouse.type || "Warehouse"}
                                        </div>
                                    </div>
                                </label>

                                <Select
                                    value={accessLevel || "edit"}
                                    onValueChange={(nextValue: "view" | "edit") => handleAccessLevelChange(warehouse.id, nextValue)}
                                    disabled={disabled || !isSelected}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Access level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="edit">View + Edit</SelectItem>
                                        <SelectItem value="view">View Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
