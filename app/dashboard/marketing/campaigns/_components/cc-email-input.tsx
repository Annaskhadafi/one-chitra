"use client"

import { useState, KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

interface Props {
    value: string[] // array of email strings
    onChange: (emails: string[]) => void
    label?: string
    description?: React.ReactNode
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function CcEmailInput({ value, onChange, label, description }: Props) {
    const [inputValue, setInputValue] = useState("")
    const [error, setError] = useState("")

    const addEmail = (raw: string) => {
        const email = raw.trim().toLowerCase()
        if (!email) return
        if (!isValidEmail(email)) {
            setError(`"${email}" bukan format email yang valid`)
            return
        }
        if (value.includes(email)) {
            setError("Email sudah ada dalam daftar CC")
            return
        }
        onChange([...value, email])
        setInputValue("")
        setError("")
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "," || e.key === ";") {
            e.preventDefault()
            addEmail(inputValue)
        }
        if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
            onChange(value.slice(0, -1))
        }
    }

    const removeEmail = (email: string) => {
        onChange(value.filter(e => e !== email))
    }

    return (
        <div className="grid gap-1.5">
            {label && <Label>{label}</Label>}
            <div
                className="flex flex-wrap gap-1.5 items-center min-h-10 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring cursor-text"
                onClick={() => document.getElementById("cc-email-input")?.focus()}
            >
                {value.map(email => (
                    <span
                        key={email}
                        className="inline-flex items-center gap-1 text-xs bg-muted border rounded-full px-2.5 py-1 shrink-0"
                    >
                        {email}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeEmail(email) }}
                            className="text-muted-foreground hover:text-foreground ml-0.5"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    id="cc-email-input"
                    type="email"
                    value={inputValue}
                    onChange={e => { setInputValue(e.target.value); setError("") }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => addEmail(inputValue)}
                    placeholder={value.length === 0 ? "Ketik email lalu tekan Enter..." : "Tambah CC lagi..."}
                    className="flex-1 bg-transparent outline-none text-sm min-w-[180px] placeholder:text-muted-foreground"
                />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                    {description}
                </div>
            )}
        </div>
    )
}
