"use client"

import { useState } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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
    items: { remainingQuantity: number }[]
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

    const handleToggleSalesOrder = (id: number) => {
        const current = form.getValues("salesOrderIds")
        if (current.includes(id)) {
            form.setValue("salesOrderIds", current.filter((i) => i !== id))
        } else {
            form.setValue("salesOrderIds", [...current, id])
        }
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
                                <FormField
                                    control={form.control}
                                    name="salesOrderIds"
                                    render={() => (
                                        <FormItem>
                                            <div className="rounded-md border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[50px]"></TableHead>
                                                            <TableHead>SO Number</TableHead>
                                                            <TableHead>Customer</TableHead>
                                                            <TableHead className="text-right">Items</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {salesOrders.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                                                    No pending orders available.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            salesOrders.map((so) => (
                                                                <TableRow
                                                                    key={so.id}
                                                                    className="cursor-pointer hover:bg-muted/50"
                                                                    onClick={() => handleToggleSalesOrder(so.id)}
                                                                >
                                                                    <TableCell>
                                                                        <Checkbox
                                                                            checked={selectedSalesOrderIds.includes(so.id)}
                                                                            onCheckedChange={() => handleToggleSalesOrder(so.id)}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell className="font-mono">
                                                                        {so.invoiceNumber || so.customerPo || "SO-" + so.id}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {so.customer.name}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Badge variant="outline">
                                                                            {so.items.length} Items
                                                                        </Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
