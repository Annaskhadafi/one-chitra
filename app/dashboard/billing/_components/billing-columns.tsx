"use strict";

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableCell } from "./editable-cell"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, FileText, Trash2, Pencil, ChevronRight, ChevronDown } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import type { BillingRecordDisplay } from "@/lib/types"

// Define a type for the action handler prop
interface ActionProps {
    row: {
        original: BillingRecordDisplay;
    }
    onEdit: (record: BillingRecordDisplay) => void
    onDelete: (poNo: string) => void
    onView: (record: BillingRecordDisplay) => void
}

const ActionCell = ({ row, onEdit, onDelete, onView }: ActionProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onView(row.original)}>
                    <FileText className="mr-2 h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(row.original)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(row.original.poNo as string)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Billing Data
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const ScanInvoiceCell = ({ url }: { url: string | null | undefined }) => {
    if (!url) return <div className="text-center text-muted-foreground">-</div>

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex justify-center cursor-pointer text-primary hover:text-primary/80 transition-colors">
                    <FileText className="h-5 w-5" />
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
                <div className="bg-muted p-3 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Scan Invoice Preview</h3>
                </div>
                <div className="flex-1 w-full bg-black/5">
                    <iframe
                        src={url}
                        className="w-full h-full border-0"
                        title="Scan Invoice Document"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

// We need a factory function to create columns with handlers
export const getColumns = (
    onEdit: (record: BillingRecordDisplay) => void,
    onDelete: (poNo: string) => void,
    onView: (record: BillingRecordDisplay) => void
): ColumnDef<BillingRecordDisplay>[] => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "expander",
            header: () => null,
            cell: ({ row }) => {
                return row.getCanExpand() ? (
                    <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={row.getToggleExpandedHandler()}
                        style={{ cursor: 'pointer' }}
                    >
                        {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                ) : null
            },
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => <ActionCell row={row} onEdit={onEdit} onDelete={onDelete} onView={onView} />
        },
        {
            accessorKey: "year",
            header: "Year",
        },
        {
            accessorKey: "month",
            header: "Month",
        },
        {
            accessorKey: "plant",
            header: "Plant",
        },
        {
            accessorKey: "customer",
            header: "Customer",
        },
        {
            accessorKey: "poNo",
            header: "PO No",
        },
        {
            accessorKey: "datePo",
            header: "Date PO",
            cell: ({ row }) => {
                const date = row.getValue("datePo")
                return date ? new Date(date as string).toLocaleDateString() : "-"
            }
        },
        // Removed Material, Qty, Curr, Price, PPN as they are moved to expanded view
        {
            accessorKey: "noInvSap",
            header: "No INV SAP",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="noInvSap" />,
        },
        {
            accessorKey: "dateInvoice",
            header: "Date Invoice",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="dateInvoice" type="date" />,
        },
        {
            accessorKey: "custId",
            header: "Cust ID",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="custId" />,
        },
        {
            accessorKey: "salesName",
            header: "Sales Name",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="salesName" />,
        },
        {
            accessorKey: "ddpAddress",
            header: "DDP / Address",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="ddpAddress" />,
        },
        {
            accessorKey: "paymentType",
            header: "Payment Type",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="paymentType" />,
        },
        {
            accessorKey: "nomorDoSap",
            header: "Nomor DO SAP",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="nomorDoSap" />,
        },
        {
            accessorKey: "actualNoDo",
            header: "Actual No DO",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="actualNoDo" />,
        },
        {
            accessorKey: "tglDoFaktur",
            header: "Tgl DO Faktur",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="tglDoFaktur" type="date" />,
        },
        {
            accessorKey: "dateSendInvoice",
            header: "Date Send Invoice",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="dateSendInvoice" type="date" />,
        },
        {
            accessorKey: "modeDelivery",
            header: "Mode Delivery",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="modeDelivery" type="select" options={["JNE", "PORTAL", "HANDCARRY", "PANDUSIWI", "CENDANA", "BYEMAIL", "TIKI", "WAHANA", "POS"]} />,
        },
        {
            accessorKey: "noResi",
            header: "No. Resi",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="noResi" />,
        },
        {
            accessorKey: "statusDelivery",
            header: "Status",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="statusDelivery" />,
        },
        {
            accessorKey: "receiverDate",
            header: "Receiver Date",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="receiverDate" type="date" />,
        },
        {
            accessorKey: "recvDateApproved",
            header: "Recv Date Approved",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="recvDateApproved" type="date" />,
        },
        {
            accessorKey: "eFaktur",
            header: "e-Faktur",
            cell: ({ row, table }) => <EditableCell row={row} rowIndex={row.index} tableMeta={table.options.meta} column="eFaktur" />,
        },
        {
            accessorKey: "scanInvUrl",
            header: "Scan INV",
            cell: ({ row }) => <ScanInvoiceCell url={row.original.scanInvUrl} />,
        },
    ]
