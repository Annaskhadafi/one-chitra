"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Pencil, Trash2, Package, Plus } from "lucide-react"
import { BundleDialog } from "./bundle-dialog"
import { deleteBundle, getBundles } from "@/app/actions/product-bundle"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface BundleTableProps {
    initialData: any[]
    allProducts: any[]
}

export function BundleTable({ initialData, allProducts }: BundleTableProps) {
    const queryClient = useQueryClient()
    const [searchTerm, setSearchTerm] = useState("")
    
    const { data: bundles = initialData } = useQuery({
        queryKey: ["product-bundles"],
        queryFn: getBundles,
        initialData,
    })

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('bundling', 'create')
    const canEdit = hasResourcePermission('bundling', 'edit')
    const canDelete = hasResourcePermission('bundling', 'delete')

    const filteredBundles = bundles.filter((bundle: any) => 
        bundle.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bundle.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = async (id: number) => {
        const res = await deleteBundle(id)
        if (res.success) {
            toast.success("Bundle deleted successfully")
            queryClient.invalidateQueries({ queryKey: ["product-bundles"] })
        } else {
            toast.error(res.error || "Failed to delete bundle")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search bundles..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {canCreate && (
                    <BundleDialog 
                        allProducts={allProducts}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["product-bundles"] })}
                        trigger={
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Bundle
                            </Button>
                        }
                    />
                )}
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Material Number</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Items Count</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredBundles.length > 0 ? (
                            filteredBundles.map((bundle: any) => (
                                <TableRow key={bundle.id}>
                                    <TableCell className="font-medium text-blue-600">
                                        {bundle.materialNumber}
                                    </TableCell>
                                    <TableCell>{bundle.materialDescription}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{bundle.category}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {bundle.bundleItems?.length || 0} Items
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {canEdit && (
                                                <BundleDialog
                                                    bundle={bundle}
                                                    allProducts={allProducts}
                                                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["product-bundles"] })}
                                                    trigger={
                                                        <Button variant="ghost" size="icon">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    }
                                                />
                                            )}
                                            {canDelete && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete bundle {bundle.materialNumber}? 
                                                                This will also delete the associated product.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction 
                                                                onClick={() => handleDelete(bundle.id)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No bundles found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
