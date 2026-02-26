import { getSmtpSettings, getEmailTemplates, getEmailLogs } from "@/app/actions/email"
import { Mail } from "lucide-react"
import { EmailSettingsClient } from "./_components/email-settings-client"

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

            <EmailSettingsClient smtpData={smtpData} templates={templates} logs={logs} />
        </div>
    )
}
