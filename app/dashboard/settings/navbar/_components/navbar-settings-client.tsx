"use client"

import type { NavbarTheme } from "@/lib/navbar-theme"
import type { EditableNavSection } from "@/lib/navigation-menu"
import { NavbarThemeForm } from "./navbar-theme-form"
import { NavbarMenuForm } from "./navbar-menu-form"

type Props = {
    initialTheme: NavbarTheme
    initialConfig: EditableNavSection[]
}

export function NavbarSettingsClient({ initialTheme, initialConfig }: Props) {
    return (
        <>
            <NavbarThemeForm initialTheme={initialTheme} />
            <NavbarMenuForm initialConfig={initialConfig} />
        </>
    )
}
