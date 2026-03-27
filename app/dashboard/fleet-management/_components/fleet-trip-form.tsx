"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createFleetTrip } from "@/app/actions/fleet-trips"
import { fleetTripSchema } from "@/lib/schemas"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Types for props
interface Driver {
    id: number
    name: string
}

interface Vehicle {
    id: number
    policeNumber: string
    type: string
}

interface SalesOrder { // Simplified from getSalesOrdersForDelivery result
    id: number
    invoiceNumber: string | null
    customerPo: string | null
    customer: { name: string }
    items: {
        id: number
        quantity: number
        remainingQuantity: number
        alreadyDelivered: number
        product?: {
            materialDescription: string | null
            materialNumber: string | null
            category: string | null
        } | null
    }[]
}

interface FleetTripFormProps {
    drivers: Driver[]
    vehicles: Vehicle[]
    salesOrders: SalesOrder[]
}

export function FleetTripForm({ drivers, vehicles, salesOrders }: FleetTripFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [openDriver, setOpenDriver] = useState(false)
    const [openVehicle, setOpenVehicle] = useState(false)
    const [salesOrderSearch, setSalesOrderSearch] = useState("")
    const [customerFilter, setCustomerFilter] = useState("all")

    const form = useForm<z.infer<typeof fleetTripSchema>>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(fleetTripSchema) as any,
        defaultValues: {
            driverId: 0,
            vehicleId: 0,
            date: new Date(),
            status: "scheduled",
            notes: "",
            costGasolineDexlite: 0,
            costGasolineBio: 0,
            costToll: 0,
            costParking: 0,
            costMeals: 0,
            costMaintenance: 0,
            costOthers: 0,
            costRapidTest: 0,
            costFerry: 0,
            costPortal: 0,
            costWashing: 0,
            costEscort: 0,
            tripDestination: "",
            salesOrderIds: [],
        },
    })

    async function onSubmit(values: z.infer<typeof fleetTripSchema>) {
        setIsSubmitting(true)
        try {
            // Convert numbers to consistent types if needed (zod handles most)
            const result = await createFleetTrip(values)

            if (result.success) {
                toast.success("Fleet trip created successfully")
                router.push("/dashboard/fleet-management")
            } else {
                toast.error(result.error || "Failed to create fleet trip")
            }
        } catch (error) {
            toast.error("Something went wrong")
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedSalesOrderIds = form.watch("salesOrderIds")

    const customerOptions = Array.from(
        new Set(
            salesOrders
                .map((order) => order.customer.name?.trim())
                .filter((name): name is string => Boolean(name))
        )
    ).sort((a, b) => a.localeCompare(b))

    const filteredSalesOrders = salesOrders.filter((so) => {
        const matchesCustomer = customerFilter === "all" || so.customer.name === customerFilter
        const searchTerm = salesOrderSearch.trim().toLowerCase()
        const matchesSearch = !searchTerm || [
            so.invoiceNumber || "",
            so.customerPo || "",
            so.customer.name || "",
            ...so.items.map((item) => item.product?.materialDescription || ""),
            ...so.items.map((item) => item.product?.materialNumber || ""),
        ].some((value) => value.toLowerCase().includes(searchTerm))

        return matchesCustomer && matchesSearch
    })

    const handleToggleSalesOrder = (id: number) => {
        const current = form.getValues("salesOrderIds")
        if (current.includes(id)) {
            form.setValue("salesOrderIds", current.filter((i) => i !== id))
        } else {
            form.setValue("salesOrderIds", [...current, id])
        }
    }

    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="min-h-[500px]" />
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* LEFT COLUMN: Trip Details */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Trip Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Date */}
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Trip Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value as Date}
                                                        onSelect={field.onChange}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Driver Selection */}
                                <FormField
                                    control={form.control}
                                    name="driverId"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Driver</FormLabel>
                                            <Popover open={openDriver} onOpenChange={setOpenDriver}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value
                                                                ? drivers.find(
                                                                    (driver) => driver.id === field.value
                                                                )?.name
                                                                : "Select driver"}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search driver..." />
                                                        <CommandList>
                                                            <CommandEmpty>No driver found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {drivers.map((driver) => (
                                                                    <CommandItem
                                                                        value={driver.name}
                                                                        key={driver.id}
                                                                        onSelect={() => {
                                                                            form.setValue("driverId", driver.id)
                                                                            setOpenDriver(false)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                driver.id === field.value
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {driver.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Vehicle Selection */}
                                <FormField
                                    control={form.control}
                                    name="vehicleId"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Vehicle</FormLabel>
                                            <Popover open={openVehicle} onOpenChange={setOpenVehicle}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                "w-full justify-between",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value
                                                                ? vehicles.find(
                                                                    (v) => v.id === field.value
                                                                )?.policeNumber
                                                                : "Select vehicle"}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search vehicle..." />
                                                        <CommandList>
                                                            <CommandEmpty>No vehicle found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {vehicles.map((vehicle) => (
                                                                    <CommandItem
                                                                        value={vehicle.policeNumber}
                                                                        key={vehicle.id}
                                                                        onSelect={() => {
                                                                            form.setValue("vehicleId", vehicle.id)
                                                                            setOpenVehicle(false)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                vehicle.id === field.value
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {vehicle.policeNumber} ({vehicle.type})
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notes</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Enter trip notes..."
                                                    className="resize-none"
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="tripDestination"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Trip Destination</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. Jakarta Pusat, Bandung..."
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Operational Costs */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Operational Costs</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="costGasolineDexlite"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Gasoline (Dexlite)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costGasolineBio"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Gasoline (Bio Solar)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costToll"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Toll</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costParking"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Parking</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costMeals"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Meals</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costMaintenance"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Maintenance</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costOthers"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Others</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costRapidTest"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rapid Test</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costFerry"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ferry Ticket</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costPortal"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Portal (Gate)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costWashing"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Car Washing</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="costEscort"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Escort (Pengawalan)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: Sales Orders Selection */}
                    <div className="space-y-6">
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle>Deliver Orders</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto max-h-[600px]">
                                <div className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                                        <Input
                                            placeholder="Search SO, PO, customer, product..."
                                            value={salesOrderSearch}
                                            onChange={(event) => setSalesOrderSearch(event.target.value)}
                                        />
                                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filter by Customer" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua Customer</SelectItem>
                                                {customerOptions.map((customerName) => (
                                                    <SelectItem key={customerName} value={customerName}>
                                                        {customerName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="rounded-md border">
                                        {filteredSalesOrders.length === 0 ? (
                                            <div className="py-4 text-center text-sm text-muted-foreground">
                                                Tidak ada sales order yang sesuai filter.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-[44px_1fr_1fr_1.2fr_110px_44px] items-center gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
                                                    <div></div>
                                                    <div>SO Number</div>
                                                    <div>Nomor PO</div>
                                                    <div>Customer</div>
                                                    <div className="text-right">Items</div>
                                                    <div></div>
                                                </div>
                                                <Accordion type="multiple" className="w-full">
                                                {filteredSalesOrders.map((so) => {
                                                    const detailItems = so.items.filter((item) => item.remainingQuantity > 0)

                                                    return (
                                                        <AccordionItem key={so.id} value={`so-${so.id}`} className="border-b last:border-b-0">
                                                            <div
                                                                className="grid grid-cols-[44px_1fr_1fr_1.2fr_110px_44px] items-center gap-3 px-4 py-3 hover:bg-muted/40"
                                                                onClick={(e) => {
                                                                    if ((e.target as HTMLElement).closest("button")) return
                                                                    handleToggleSalesOrder(so.id)
                                                                }}
                                                            >
                                                                <div>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="size-4 rounded-sm border-input shadow-sm accent-primary cursor-pointer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        checked={selectedSalesOrderIds.includes(so.id)}
                                                                        onChange={() => handleToggleSalesOrder(so.id)}
                                                                    />
                                                                </div>
                                                                <div className="font-mono text-sm">
                                                                    {so.invoiceNumber || `SO-${so.id}`}
                                                                </div>
                                                                <div className="font-mono text-sm">
                                                                    {so.customerPo || "-"}
                                                                </div>
                                                                <div className="text-sm">
                                                                    {so.customer.name}
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge variant="outline">
                                                                        {detailItems.length} Items
                                                                    </Badge>
                                                                </div>
                                                                <AccordionTrigger className="justify-self-end py-0 hover:no-underline" />
                                                            </div>
                                                            <AccordionContent className="px-4 pb-4">
                                                                <div className="overflow-x-auto rounded-md border bg-muted/20">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow>
                                                                                <TableHead>Product</TableHead>
                                                                                <TableHead>Material Number</TableHead>
                                                                                <TableHead>Category</TableHead>
                                                                                <TableHead className="text-right">Ordered</TableHead>
                                                                                <TableHead className="text-right">Delivered</TableHead>
                                                                                <TableHead className="text-right">Outstanding</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {detailItems.length === 0 ? (
                                                                                <TableRow>
                                                                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                                                        Tidak ada detail item outstanding.
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ) : (
                                                                                detailItems.map((item) => (
                                                                                    <TableRow key={item.id}>
                                                                                        <TableCell className="text-sm font-medium">
                                                                                            {item.product?.materialDescription || item.product?.materialNumber || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell className="font-mono text-xs">
                                                                                            {item.product?.materialNumber || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-sm">
                                                                                            {item.product?.category || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right">
                                                                                            {item.quantity.toLocaleString("id-ID")}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right">
                                                                                            {item.alreadyDelivered.toLocaleString("id-ID")}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right font-medium">
                                                                                            {item.remainingQuantity.toLocaleString("id-ID")}
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ))
                                                                            )}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    )
                                                })}
                                                </Accordion>
                                            </>
                                        )}
                                    </div>
                                    {form.formState.errors.salesOrderIds && (
                                        <p className="text-[0.8rem] font-medium text-destructive">
                                            {form.formState.errors.salesOrderIds.message}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex gap-4 justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Trip
                    </Button>
                </div>
            </form>
        </Form>
    )
}
