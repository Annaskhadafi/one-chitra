import { NextResponse } from "next/server"
import { getSmtpSettings, saveSmtpSettings } from "@/app/actions/email"

export async function GET() {
    const settings = await getSmtpSettings()
    // Never expose the password in GET response
    if (settings) {
        return NextResponse.json({ ...settings, password: "••••••••" })
    }
    return NextResponse.json(null)
}

export async function POST(req: Request) {
    const body = await req.json()
    const result = await saveSmtpSettings(body)
    return NextResponse.json(result)
}
