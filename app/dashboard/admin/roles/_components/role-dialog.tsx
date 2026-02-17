"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createRole, updateRole, RoleWithPermissions } from "@/app/actions/roles"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const roleSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    permissionIds: z.array(z.number()),
})

export interface PermissionGroup {
    [resource: string]: {
        id: number
        resource: string
        action: string
        description: string | null
    }[]
}

interface RoleDialogProps {
    role?: RoleWithPermissions
    allPermissions: PermissionGroup
    trigger: React.ReactNode
}

export function RoleDialog({ role, allPermissions, trigger }: RoleDialogProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const form = useForm<z.infer<typeof roleSchema>>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: role?.name || "",
            description: role?.description || "",
            permissionIds: role?.permissions?.map(Number) || [],
        },
    })

    async function onSubmit(values: z.infer<typeof roleSchema>) {
        try {
            const data = {
                name: values.name,
                description: values.description || "",
                permissionIds: values.permissionIds,
            }

            const result = role ? await updateRole(role.id, data) : await createRole(data)

            if (result.success) {
                toast.success(role ? "Role updated successfully" : "Role created successfully")
                setOpen(false)
                router.refresh()
            } else {
                toast.error(result.error || "Something went wrong")
            }
        } catch {
            toast.error("An error occurred")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{role ? "Edit Role" : "Create Role"}</DialogTitle>
                    <DialogDescription>
                        Configure role details and assign permissions.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Content Editor" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Role description" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-base">Permissions</Label>
                            <div className="border rounded-lg p-4 grid gap-6">
                                {Object.entries(allPermissions).map(([resource, perms]) => (
                                    <div key={resource} className="grid grid-cols-12 gap-4 items-center border-b pb-4 last:border-0 last:pb-0">
                                        <div className="col-span-3 font-medium capitalize">
                                            {resource}
                                        </div>
                                        <div className="col-span-9 grid grid-cols-4 gap-4">
                                            {perms.map((perm) => (
                                                <FormField
                                                    key={perm.id}
                                                    control={form.control}
                                                    name="permissionIds"
                                                    render={({ field }) => {
                                                        return (
                                                            <FormItem
                                                                key={perm.id}
                                                                className="flex flex-row items-start space-x-2 space-y-0"
                                                            >
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value?.includes(perm.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            return checked
                                                                                ? field.onChange([...field.value, perm.id])
                                                                                : field.onChange(
                                                                                    field.value?.filter(
                                                                                        (value) => value !== perm.id
                                                                                    )
                                                                                )
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="font-normal capitalize cursor-pointer">
                                                                    {perm.action}
                                                                </FormLabel>
                                                            </FormItem>
                                                        )
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="submit">{role ? "Save Changes" : "Create Role"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
