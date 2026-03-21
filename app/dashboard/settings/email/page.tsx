import { getSmtpSettings, getEmailTemplates, getEmailLogs, getEmailNotificationRules } from "@/app/actions/email"
import { db } from "@/db"
import { roles } from "@/db/schema"
import { asc } from "drizzle-orm"
import { Mail } from "lucide-react"
import { EmailSettingsClient } from "./_components/email-settings-client"
import { normalizeRecipientRoleName } from "@/lib/revenue-report-config"

export const metadata = {
    title: "Email Settings – One Chitra",
}

export default async function EmailSettingsPage() {
    const [smtpData, templates, logs, rules, users, roleRows] = await Promise.all([
        getSmtpSettings(),
        getEmailTemplates(),
        getEmailLogs(100),
        getEmailNotificationRules(),
        db.query.user.findMany({
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
            orderBy: (fields, { asc }) => [asc(fields.name)],
        }),
        db.select({ name: roles.name }).from(roles).orderBy(asc(roles.name)),
    ])

    const recipientUsers = users.filter(
        (user): user is typeof users[number] & { email: string } => Boolean(user.email?.trim()),
    )

    const roleLabelByKey = new Map<string, string>()

    for (const roleName of [
        ...roleRows.map((role) => role.name),
        ...recipientUsers.map((currentUser) => currentUser.role),
    ]) {
        const label = roleName?.trim()
        const key = normalizeRecipientRoleName(label)

        if (!label || !key || roleLabelByKey.has(key)) {
            continue
        }

        roleLabelByKey.set(key, label)
    }

    const recipientRoles = Array.from(roleLabelByKey.values())
        .sort((left, right) => left.localeCompare(right))

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

            <EmailSettingsClient
                smtpData={smtpData}
                templates={templates}
                logs={logs}
                rules={rules}
                recipientUsers={recipientUsers}
                recipientRoles={recipientRoles}
            />
        </div>
    )
}
