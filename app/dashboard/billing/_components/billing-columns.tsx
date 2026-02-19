"use strict";

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableCell } from "./editable-cell"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, FileText, Trash2, Pencil } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Define a type for the action handler prop
interface ActionProps {
    row: any
    onEdit: (record: any) => void
    onDelete: (id: number) => void
    onView: (record: any) => void
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
                <DropdownMenuItem onClick={() => onDelete(row.original.deliveryItemId)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Billing Data
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// We need a factory function to create columns with handlers
export const getColumns = (
    onEdit: (record: any) => void,
    onDelete: (id: number) => void,
    onView: (record: any) => void
): ColumnDef<any>[] => [
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
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => <ActionCell row={row} onEdit={onEdit} onDelete={onDelete} onView={onView} />
        },
        {
            accessorKey: "no",
            header: "No",
            cell: ({ row }) => <EditableCell row={row} column="no" />,
        },
        {
            accessorKey: "year",
            header: "Year",
            cell: ({ row }) => <EditableCell row={row} column="year" type="number" />,
        },
        {
            accessorKey: "month",
            header: "Month",
            cell: ({ row }) => <EditableCell row={row} column="month" />,
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
        {
            accessorKey: "materialNumber",
            header: "Material Number",
        },
        {
            accessorKey: "materialDescription",
            header: "Material Description",
        },
        {
            accessorKey: "qty",
            header: "Qty",
        },
        {
            accessorKey: "curr",
            header: "Curr",
            cell: ({ row }) => <EditableCell row={row} column="curr" />,
        },
        {
            accessorKey: "pricePerPcsIdr",
            header: "Price/Pcs IDR",
            cell: ({ row }) => <EditableCell row={row} column="pricePerPcsIdr" type="number" />,
        },
        {
            accessorKey: "totalPriceIdr",
            header: "Total Price IDR",
            cell: ({ row }) => <EditableCell row={row} column="totalPriceIdr" type="number" />,
        },
        {
            accessorKey: "ppn",
            header: "PPN",
            cell: ({ row }) => <EditableCell row={row} column="ppn" type="number" />,
        },
        {
            accessorKey: "price",
            header: "Price",
            cell: ({ row }) => <EditableCell row={row} column="price" type="number" />,
        },
        {
            accessorKey: "includePpn",
            header: "Include PPN",
            cell: ({ row }) => <EditableCell row={row} column="includePpn" type="number" />,
        },
        {
            accessorKey: "noInvSap",
            header: "No INV SAP",
            cell: ({ row }) => <EditableCell row={row} column="noInvSap" />,
        },
        {
            accessorKey: "dateInvoice",
            header: "Date Invoice",
            cell: ({ row }) => <EditableCell row={row} column="dateInvoice" type="date" />,
        },
        {
            accessorKey: "custId",
            header: "Cust ID",
            cell: ({ row }) => <EditableCell row={row} column="custId" />,
        },
        {
            accessorKey: "salesName",
            header: "Sales Name",
            cell: ({ row }) => <EditableCell row={row} column="salesName" />,
        },
        {
            accessorKey: "ddpAddress",
            header: "DDP / Address",
            cell: ({ row }) => <EditableCell row={row} column="ddpAddress" />,
        },
        {
            accessorKey: "paymentType",
            header: "Payment Type",
            cell: ({ row }) => <EditableCell row={row} column="paymentType" />,
        },
        {
            accessorKey: "nomorDoSap",
            header: "Nomor DO SAP",
            cell: ({ row }) => <EditableCell row={row} column="nomorDoSap" />,
        },
        {
            accessorKey: "actualNoDo",
            header: "Actual No DO",
            cell: ({ row }) => <EditableCell row={row} column="actualNoDo" />,
        },
        {
            accessorKey: "tglDoFaktur",
            header: "Tgl DO Faktur",
            cell: ({ row }) => <EditableCell row={row} column="tglDoFaktur" type="date" />,
        },
        {
            accessorKey: "remaks",
            header: "Remaks",
            cell: ({ row }) => <EditableCell row={row} column="remaks" />,
        },
        {
            accessorKey: "dateSendInvoice",
            header: "Date Send Invoice",
            cell: ({ row }) => <EditableCell row={row} column="dateSendInvoice" type="date" />,
        },
        {
            accessorKey: "receiverDate",
            header: "Receiver Date",
            cell: ({ row }) => <EditableCell row={row} column="receiverDate" type="date" />,
        },
        {
            accessorKey: "recvDateApproved",
            header: "Recv Date Approved",
            cell: ({ row }) => <EditableCell row={row} column="recvDateApproved" type="date" />,
        },
        {
            accessorKey: "eFaktur",
            header: "e-Faktur",
            cell: ({ row }) => <EditableCell row={row} column="eFaktur" />,
        },
    ]
