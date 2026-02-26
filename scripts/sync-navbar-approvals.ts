import "dotenv/config"
import { db } from "../db"
import { settings } from "../db/schema/settings"
import { eq } from "drizzle-orm"

const NAVBAR_MENU_SETTING_KEY = "navbar_menu_config_v1"

type NavSubItem = {
  id: string
  title: string
  url: string
  resource: string | null
  hidden: boolean
  openInNewTab: boolean
  isCustom: boolean
  linkType: "internal" | "external"
  externalOpenMode: "new_tab" | "iframe"
  iframeManualEnabled: boolean
  iframeManualCode: string
}

type NavItem = {
  id: string
  title: string
  url: string
  iconName: string
  resource: string | null
  hidden: boolean
  openInNewTab: boolean
  isCustom: boolean
  linkType: "internal" | "external"
  externalOpenMode: "new_tab" | "iframe"
  iframeManualEnabled: boolean
  iframeManualCode: string
  items: NavSubItem[]
}

type NavSection = {
  id: string
  title: string
  items: NavItem[]
}

const APPROVAL_INBOX_URL = "/dashboard/approvals"
const APPROVAL_SETTINGS_URL = "/dashboard/settings/approvals"
const APPROVAL_MATRIX_URL = "/dashboard/approvals/matrix"

function makeSectionId(title: string) {
  return `sync-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`
}

function makeItemId(title: string) {
  return `sync-item-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`
}

function makeSubItem(title: string, url: string): NavSubItem {
  const id = `sync-approval-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    title,
    url,
    resource: "approvals",
    hidden: false,
    openInNewTab: false,
    isCustom: true,
    linkType: "internal",
    externalOpenMode: "new_tab",
    iframeManualEnabled: false,
    iframeManualCode: "",
  }
}

function makeApprovalGroupItem(): NavItem {
  return {
    id: makeItemId("Approval"),
    title: "Approval",
    url: "#",
    iconName: "Circle",
    resource: "approvals",
    hidden: false,
    openInNewTab: false,
    isCustom: true,
    linkType: "internal",
    externalOpenMode: "new_tab",
    iframeManualEnabled: false,
    iframeManualCode: "",
    items: [],
  }
}

function ensureApprovalSection(config: NavSection[]) {
  const existing = config.find((section) => section.title.toLowerCase() === "approval")
  if (existing) {
    return existing
  }

  const section: NavSection = {
    id: makeSectionId("approval"),
    title: "Approval",
    items: [],
  }

  const systemIndex = config.findIndex((section) => section.title.toLowerCase() === "system management")
  if (systemIndex >= 0) {
    config.splice(systemIndex, 0, section)
  } else {
    config.push(section)
  }

  return section
}

function removeFromAdmin(config: NavSection[]) {
  const systemSection = config.find((section) => section.title.toLowerCase() === "system management")
  if (!systemSection) {
    return 0
  }

  const adminItem = systemSection.items.find((item) => item.title.toLowerCase() === "admin")
  if (!adminItem) {
    return 0
  }

  const before = adminItem.items.length
  adminItem.items = adminItem.items.filter((item) => item.url !== APPROVAL_INBOX_URL && item.url !== APPROVAL_SETTINGS_URL && item.url !== APPROVAL_MATRIX_URL)
  return before - adminItem.items.length
}

async function main() {
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
    .limit(1)

  if (!row[0]?.value) {
    console.log("Navbar setting not found. Default navigation already includes approval menus.")
    process.exit(0)
  }

  let config: NavSection[]
  try {
    config = JSON.parse(row[0].value) as NavSection[]
  } catch {
    console.log("Navbar setting JSON invalid. Please reset navbar settings from UI.")
    process.exit(1)
  }

  const approvalSection = ensureApprovalSection(config)
  let approvalGroup = approvalSection.items.find((item) => item.title.toLowerCase() === "approval")
  if (!approvalGroup) {
    approvalGroup = makeApprovalGroupItem()
    approvalSection.items.push(approvalGroup)
  }

  const removedFromAdmin = removeFromAdmin(config)

  const hasInbox = approvalGroup.items.some((item) => item.url === APPROVAL_INBOX_URL)
  const hasSettings = approvalGroup.items.some((item) => item.url === APPROVAL_SETTINGS_URL)
  const hasMatrix = approvalGroup.items.some((item) => item.url === APPROVAL_MATRIX_URL)

  let addedToApproval = 0
  if (!hasInbox) {
    approvalGroup.items.unshift(makeSubItem("Approval Inbox", APPROVAL_INBOX_URL))
    addedToApproval += 1
  }

  if (!hasSettings) {
    approvalGroup.items.push(makeSubItem("Approval Settings", APPROVAL_SETTINGS_URL))
    addedToApproval += 1
  }

  if (!hasMatrix) {
    approvalGroup.items.push(makeSubItem("Matrix Approval", APPROVAL_MATRIX_URL))
    addedToApproval += 1
  }

  if (addedToApproval === 0 && removedFromAdmin === 0) {
    console.log("Approval section already up to date in navbar config.")
    process.exit(0)
  }

  await db
    .update(settings)
    .set({ value: JSON.stringify(config), updatedAt: new Date() })
    .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))

  console.log(`Navbar sync complete. Added ${addedToApproval} item(s) to Approval section, removed ${removedFromAdmin} duplicate(s) from Admin.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed syncing navbar approvals:", error)
    process.exit(1)
  })
