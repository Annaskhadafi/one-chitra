"use client"

import { Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, FileText, Activity } from "lucide-react"
import { SmtpSettingsForm } from "./smtp-settings-form"
import { TemplateList } from "./template-list"
import { EmailLogsTable } from "./email-logs"
import type { smtpSettings, emailTemplates, emailLogs } from "@/db/schema/email"

type SmtpRow = typeof smtpSettings.$inferSelect
type Template = typeof emailTemplates.$inferSelect
type Log = typeof emailLogs.$inferSelect

type Props = {
    smtpData: SmtpRow | null
    templates: Template[]
    logs: Log[]
}

export function EmailSettingsClient({ smtpData, templates, logs }: Props) {
    return (
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
    )
}
