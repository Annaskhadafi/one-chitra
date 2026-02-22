import { NextResponse } from "next/server"
import { getEmailTemplates, createEmailTemplate } from "@/app/actions/email"

export async function GET() {
    const templates = await getEmailTemplates()
    return NextResponse.json(templates)
}

export async function POST(req: Request) {
    const body = await req.json()
    const result = await createEmailTemplate(body)
    return NextResponse.json(result)
}
