"use client"

import { useState } from "react"
import { createCampaign } from "@/app/actions/marketing-campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

export default function CreateCampaignPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        subject: "",
        content: "",
        segmentCriteria: "all"
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await createCampaign(formData)
            if (res.success) {
                toast.success("Campaign created successfully")
                router.push("/dashboard/marketing/campaigns")
            } else {
                toast.error(res.error || "Failed to create campaign")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/marketing/campaigns">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create New Campaign</h1>
                    <p className="text-muted-foreground">Design your email blast and select recipients.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Campaign Details</CardTitle>
                        <CardDescription>Fill in the information for your marketing campaign.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Campaign Name (Internal)</Label>
                            <Input 
                                id="name" 
                                placeholder="e.g. End of Year Sale 2026" 
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="subject">Email Subject</Label>
                            <Input 
                                id="subject" 
                                placeholder="e.g. Special Offer Just For You!" 
                                value={formData.subject}
                                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="segment">Target Audience</Label>
                            <Select 
                                value={formData.segmentCriteria} 
                                onValueChange={(val) => setFormData({...formData, segmentCriteria: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select segment" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Customers (with Email)</SelectItem>
                                    <SelectItem value="city:Jakarta">Customers in Jakarta</SelectItem>
                                    <SelectItem value="city:Surabaya">Customers in Surabaya</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Select which customers should receive this email.</p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="content">Email Content (HTML)</Label>
                            <Textarea 
                                id="content" 
                                placeholder="<h1>Hello {{name}}!</h1><p>Check out our latest offers...</p>" 
                                className="min-h-[300px] font-mono"
                                value={formData.content}
                                onChange={(e) => setFormData({...formData, content: e.target.value})}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Supports HTML. Use <code>{`{{name}}`}</code> to insert customer name dynamically.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Link href="/dashboard/marketing/campaigns">
                                <Button variant="outline" type="button">Cancel</Button>
                            </Link>
                            <Button type="submit" disabled={loading}>
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? "Saving..." : "Save Draft"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
