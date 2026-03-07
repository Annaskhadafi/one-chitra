"use client"

import { useState, useEffect } from "react"
import { getCampaigns, deleteCampaign, sendCampaignNow } from "@/app/actions/marketing-campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash, Edit, RefreshCw, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
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

interface Campaign {
    id: number;
    name: string;
    subject: string;
    status: string;
    successCount: number | null;
    failureCount: number | null;
    totalRecipients: number | null;
    createdAt: Date;
}

export default function MarketingCampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [sendingId, setSendingId] = useState<number | null>(null)

    const loadCampaigns = async () => {
        setLoading(true)
        const data = await getCampaigns()
        setCampaigns(data)
        setLoading(false)
    }

    useEffect(() => {
        loadCampaigns()
    }, [])

    const handleDelete = async (id: number) => {
        const res = await deleteCampaign(id)
        if (res.success) {
            toast.success("Campaign deleted")
            loadCampaigns()
        } else {
            toast.error("Failed to delete campaign")
        }
    }

    const handleSend = async (id: number) => {
        setSendingId(id)
        toast.info("Sending campaign... do not close this page.")
        const res = await sendCampaignNow(id)
        if (res.success) {
            toast.success(`Campaign sent! Success: ${res.sent}, Failed: ${res.failed}`)
            loadCampaigns()
        } else {
            toast.error(res.error || "Failed to send campaign")
        }
        setSendingId(null)
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Marketing Campaigns</h1>
                    <p className="text-muted-foreground">Manage and send email blasts to your customers.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={loadCampaigns}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href="/dashboard/marketing/campaigns/create">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            New Campaign
                        </Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Campaign History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Sent / Total</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
                                </TableRow>
                            ) : campaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No campaigns found. Create your first one!
                                    </TableCell>
                                </TableRow>
                            ) : (
                                campaigns.map((campaign) => (
                                    <TableRow key={campaign.id}>
                                        <TableCell className="font-medium">{campaign.name}</TableCell>
                                        <TableCell>{campaign.subject}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                campaign.status === 'sent' ? 'default' :
                                                    campaign.status === 'processing' ? 'secondary' :
                                                        'outline'
                                            }>
                                                {campaign.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {campaign.status === 'sent' ?
                                                `${campaign.successCount} / ${campaign.totalRecipients}` :
                                                '-'
                                            }
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(campaign.createdAt), "dd MMM yyyy HH:mm")}
                                        </TableCell>
                                        <TableCell className="text-right flex justify-end gap-2">
                                            {campaign.status === 'draft' && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" disabled={sendingId === campaign.id}>
                                                            <Send className={`h-4 w-4 text-green-600 ${sendingId === campaign.id ? 'animate-pulse' : ''}`} />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Send Campaign Now?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will send emails to all matched customers immediately. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleSend(campaign.id)}>Send Emails</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}

                                            <Link href={`/dashboard/marketing/campaigns/${campaign.id}/edit`}>
                                                <Button variant="ghost" size="icon" disabled={campaign.status !== 'draft'}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </Link>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete this campaign?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(campaign.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
