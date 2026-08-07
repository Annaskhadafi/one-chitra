import { getEmbedTokensAction, getEmbedUsersAction } from "@/app/actions/embed-generator";
import { EmbedGeneratorClient } from "./_components/embed-generator-client";
import { PageHeader } from "@/components/page-header";
import { Code } from "lucide-react";
import { navigationConfig } from "@/lib/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function extractPagesFromNavigation() {
    const pages: { path: string; name: string }[] = [];

    function processItems(items: any[]) {
        for (const item of items) {
            if (item.url && item.url !== "#" && item.url.startsWith("/dashboard")) {
                const isCritical = 
                    item.url.includes("/security") || 
                    item.url.includes("/settings") || 
                    item.url.includes("/admin") ||
                    item.resource === "admin" ||
                    item.resource === "security";

                if (!isCritical) {
                    pages.push({
                        path: item.url,
                        name: item.title || "Unnamed Page",
                    });
                }
            }

            if (item.items && item.items.length > 0) {
                processItems(item.items);
            }
        }
    }

    for (const section of navigationConfig) {
        processItems(section.items);
    }

    const uniquePages = pages.filter(
        (page, index, self) => self.findIndex((p) => p.path === page.path) === index
    );

    return uniquePages.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export default async function EmbedGeneratorPage() {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") || "localhost:3000";
    const protocol = requestHeaders.get("x-forwarded-proto") || "http";
    const origin = `${protocol}://${host}`;

    const [tokens, users] = await Promise.all([
        getEmbedTokensAction(),
        getEmbedUsersAction(),
    ]);

    const targetPages = extractPagesFromNavigation();

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="min-w-0 w-full">
                <PageHeader
                    title="Embed Web Generator"
                    subtitle="Hasilkan kode iframe dengan secure token untuk di-embed ke sistem eksternal (misal: hero.chitraparatama.com) tanpa perlu login ulang."
                    icon={Code}
                />
            </div>
            
            <EmbedGeneratorClient 
                initialTokens={tokens} 
                users={users} 
                targetPages={targetPages} 
                origin={origin}
            />
        </div>
    );
}
