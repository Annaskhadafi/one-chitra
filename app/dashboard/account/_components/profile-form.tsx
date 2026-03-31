"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { IconLoader2, IconUpload } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { updateProfile } from "@/app/actions/users"
import { uploadFile } from "@/app/actions/upload"
import { getAvatarInitials, getGeneratedAvatarDataUri } from "@/lib/avatar"

const profileFormSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    email: z.string().email().readonly(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm({ user }: { user: { id: string; name: string; email: string; image?: string | null; department?: string; jobTitle?: string } }) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(user.image ?? null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            name: user.name,
            email: user.email,
            department: user.department ?? "",
            jobTitle: user.jobTitle ?? "",
        },
    })

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl)
            }
        }
    }, [previewUrl])

    const displayName = form.watch("name")
    const avatarSrc = previewUrl || getGeneratedAvatarDataUri({
        image: user.image,
        name: displayName,
        email: user.email,
        seed: user.id,
    })

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null
        if (!file) return

        if (!file.type.startsWith("image/")) {
            toast.error("File harus berupa gambar")
            event.target.value = ""
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Ukuran foto maksimal 5MB")
            event.target.value = ""
            return
        }

        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(file))
    }

    async function onSubmit(data: ProfileFormValues) {
        setIsLoading(true)
        try {
            let imageUrl = user.image ?? undefined

            if (selectedFile) {
                const formData = new FormData()
                formData.append("file", selectedFile)

                const uploadResult = await uploadFile(formData)
                if (!uploadResult.success || !uploadResult.url) {
                    toast.error(uploadResult.error || "Upload foto profil gagal")
                    setIsLoading(false)
                    return
                }

                imageUrl = uploadResult.url
            }

            const result = await updateProfile({
                name: data.name,
                image: imageUrl,
                department: data.department,
                jobTitle: data.jobTitle,
            })
            if (result.success) {
                toast.success("Profile updated successfully")
                setSelectedFile(null)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to update profile")
            }
        } catch (_error) {
            toast.error("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                    Update your account details.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="rounded-2xl border bg-muted/20 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <Avatar className="h-24 w-24 rounded-3xl ring-4 ring-background shadow-sm">
                                    <AvatarImage src={avatarSrc} alt={displayName || user.name} />
                                    <AvatarFallback className="rounded-3xl text-lg font-semibold">
                                        {getAvatarInitials(displayName || user.name, user.email)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-2">
                                    <div>
                                        <Label htmlFor="profile-photo">Foto Profil</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Upload foto sendiri, atau biarkan sistem pakai avatar otomatis yang tetap keren di chat.
                                        </p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        id="profile-photo"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                            <IconUpload className="mr-2 h-4 w-4" />
                                            Upload Foto
                                        </Button>
                                        {selectedFile ? (
                                            <p className="self-center text-xs text-muted-foreground">
                                                {selectedFile.name}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Your name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="jobTitle"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jabatan</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Contoh: Finance Manager" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="department"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Contoh: Finance" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled />
                                    </FormControl>
                                    <FormDescription>
                                        Your email address cannot be changed.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Profile
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
