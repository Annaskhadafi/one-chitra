
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function DebugSessionPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Session Debug</h1>
            <pre className="bg-slate-100 p-4 rounded overflow-auto">
                {JSON.stringify(session, null, 2)}
            </pre>
        </div>
    );
}
