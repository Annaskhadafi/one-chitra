import { Suspense } from "react"
import { getSmtpSettings, getEmailTemplates, getEmailLogs } from "@/app/actions/email"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, Settings, FileText, Activity } from "lucide-react"
import { SmtpSettingsForm } from "./_components/smtp-settings-form"
import { TemplateList } from "./_components/template-list"
import { EmailLogsTable } from "./_components/email-logs"

export const metadata = {
    title: "Email Settings – One Chitra",
}

export default async function EmailSettingsPage() {
    const [smtpData, templates, logs] = await Promise.all([
        getSmtpSettings(),
        getEmailTemplates(),
        getEmailLogs(100),
    ])

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Email Settings</h1>
                    <p className="text-muted-foreground text-sm">
                        Configure SMTP, manage email templates, and view delivery logs.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="smtp" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="smtp" className="gap-2">
                        <Settings className="h-4 w-4" />
                        SMTP
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Templates
                        {templates.length > 0 && (
                            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                {templates.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Logs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="smtp">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>}>
                        <SmtpSettingsForm initialData={smtpData} />
                    </Suspense>
                </TabsContent>

                <TabsContent value="templates">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>}>
                        <TemplateList initialTemplates={templates} />
                    </Suspense>
                </TabsContent>

                <TabsContent value="logs">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>}>
                        <EmailLogsTable logs={logs} />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    )
}
