import React, { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { MessageSquareText } from "lucide-react";
import {
    getGatewayStatusAction,
    getRegisteredNumbersAction,
    getWhatsAppLogsAction,
    getSystemUsersAction,
} from "@/app/actions/whatsapp";
import { WhatsAppDashboardClient } from "./_components/whatsapp-dashboard-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppCenterPage() {
    const [statusRes, numbersRes, logsRes, usersRes] = await Promise.all([
        getGatewayStatusAction(),
        getRegisteredNumbersAction(),
        getWhatsAppLogsAction(),
        getSystemUsersAction(),
    ]);

    const initialStatus = statusRes;
    const initialNumbers = numbersRes.success ? numbersRes.data : [];
    const initialLogs = logsRes.success
        ? { messages: logsRes.messages, notifLogs: logsRes.notifLogs }
        : { messages: [], notifLogs: [] };
    const systemUsers = usersRes.success ? usersRes.users : [];

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="min-w-0 w-full">
                <PageHeader
                    title="WhatsApp Center & AI Bot"
                    subtitle="Kelola koneksi WhatsApp resmi, whitelist nomor terdaftar dengan pembatasan hak akses (RBAC), monitoring notifikasi transaksi, dan interaksi AI Agent dengan tools MCP."
                    icon={MessageSquareText}
                />
            </div>

            <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Memuat WhatsApp Center...</div>}>
                <WhatsAppDashboardClient
                    initialStatus={initialStatus}
                    initialNumbers={initialNumbers}
                    initialLogs={initialLogs}
                    systemUsers={systemUsers}
                />
            </Suspense>
        </div>
    );
}
