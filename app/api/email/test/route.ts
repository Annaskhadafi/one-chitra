import { NextResponse } from "next/server"
import { testSmtpConnection } from "@/app/actions/email"

export async function POST(req: Request) {
    const body = await req.json()
    const result = await testSmtpConnection(body)
    return NextResponse.json(result)
}
