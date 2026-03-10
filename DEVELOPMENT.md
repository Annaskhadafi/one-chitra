# One Chitra Development Guidelines

## 📁 File Upload Rule (Standardized)

To ensure uploaded files are persistent across deployments on Dokploy, all file uploads MUST follow this unified rule:

### 1. Storage Location
Files are stored in the `public/uploads` directory.

| Environment | Actual Path | Notes |
|---|---|---|
| **Development** | `<project-root>/public/uploads` | `process.cwd()` = project root |
| **Production (Nixpacks)** | `/app/.next/standalone/public/uploads` | `process.cwd()` = `/app/.next/standalone` in standalone mode |

On production (Dokploy), the container path `/app/.next/standalone/public/uploads` is mapped to a **Persistent Bind Mount** at `/mnt/data/one-chitra/uploads` on the VPS.

Mount Type
BIND
Host Path
/mnt/data/one-chitra/uploads
Mount Path
/app/.next/standalone/public/uploads

> ⚠️ **PENTING: Jangan gunakan `process.cwd()` secara langsung di enviroment Production (Dokploy)**
> Aplikasi Next.js under Dokploy Docker sering me-run CWD di `/app` (bukan di dalam `.next/standalone`), sehingga jika menggunakan `process.cwd()` file akan meleset ke `/app/public/uploads` (temporary) dan tidak masuk ke Bind Mount.
> **Selalu gunakan deteksi environment:**
> - Production: Hardcode path absolute ke `/app/.next/standalone/public/uploads`
> - Development: `resolve(process.cwd(), "public", "uploads")`

### 2. Upload Action
Always use the centralized `uploadFile` action. Do NOT use `fs` directly in your components or other actions.

**Usage:**
```typescript
import { uploadFile } from "@/app/actions/upload"

const formData = new FormData()
formData.append("file", fileInstance)

const result = await uploadFile(formData)
if (result.success) {
  const fileUrl = result.url // Returns something like "/api/uploads/uuid.png"
}
```

### 3. File Serving
Files are served via a custom API route to bypass Next.js static asset limitations in standalone mode:
`GET /api/uploads/[filename]`

### 4. Supported Types
The system automatically detects and sets the correct headers for:
- Images (JPG, PNG, WebP, GIF)
- Documents (PDF)
- Others (Octet-stream)

---

---

## � Role Management & Permissions (RBAC)

To ensure consistent access control, all new features MUST integrate with the central permission system.

### 1. Registering New Resources
When adding a new module/page, register its resource name in `lib/navigation.ts`:
```typescript
{
  title: "My New Feature",
  url: "/dashboard/my-feature",
  icon: MyIcon,
  resource: "my-feature", // This is the identifier for permissions
}
```

### 2. Permission Naming Convention
Actions are standardized as: `view`, `create`, `edit`, `delete`.
Permissions are mapped as `resource:action` (e.g., `sales-orders:edit`).

### 3. Permission Sync
After adding a new resource to `navigationConfig`, run the "Sync Permissions" action in the **Admin > Roles** page. This will automatically generate the four standard permissions for your new resource in the database.

### 4. Client-Side Checks (`usePermissions`)
Use the `usePermissions` hook to hide/show UI elements dynamically.
```typescript
import { usePermissions } from "@/hooks/use-permissions"

const { hasResourcePermission } = usePermissions()
const canEdit = hasResourcePermission('my-resource', 'edit')

{canEdit && <Button>Edit Item</Button>}
```

### 5. Nested or Server-Side Guards (`PermissionGuard`)
Use the `PermissionGuard` component for higher-level wrapping.
```typescript
import { PermissionGuard } from "@/components/permission-guard"

<PermissionGuard resource="my-resource" action="create">
  <MyCreationForm />
</PermissionGuard>
```

---

## 📥 Import & Export Features

When implementing Import functionality for a table, follow these standards:

### 1. CSV Template/Example
Provide a download button for a CSV example data with correct headers to guide the user.

### 2. Field Mapping
The import dialog MUST include a mapping step where users can match CSV columns to database fields.

### 3. CSV Export
Always provide an Export button to download the table data as CSV.

---

## ✨ UI/UX Standard: Actions & Previews

### 1. Document Preview (Detail View)
- Use a **Large Dialog (max-w-4xl/5xl)** or a clean "Document-style" layout.
- It should feel like a official document, not just a list of labels.
- MUST include an **"Edit" button** within the preview for quick transition.

### 2. File Upload Preview
If a record has an uploaded file (PDF or Image):
- Add a dedicated "Preview File" action.
- Use a **Wide Dialog/Iframe Popup** to display the content clearly without leaving the page.

### 3. Inline Status Change
If a table has a **Status** column:
- Users with `edit` permission should be able to click the status badge directly in the list.
- Use a **Popover or Select** dropdown to change the status immediately without opening the full Edit form.
- Trigger a server action and refresh the router/query after selection.

---

## 📄 PDF & Print Preview Standards

When creating features that require document printing (Invoice, DO, Reports, Quotation, Sticker, etc):

### 1. Unified CSS Styling (WYSIWYG)
Always share the same CSS structure between the **Screen Preview** and the **Print Output** to ensure "What You See Is What You Get".
- Wrap the content in a `.pdf-wrapper` class.
- Define a base font size (usually `10pt`) and use `Arial/sans-serif` for clarity.

### 2. High-Width Modal Overrides
The base `DialogContent` has a responsive `sm:max-w-lg` constraint. To show an A4 document properly:
- MUST use `sm:max-w-7xl` or higher on the `DialogContent`.
- Always verify that the modal doesn't "squish" the document on Desktop views.

### 3. Print-Safe Styles
Ensure that internal information or specific footers use fixed positioning or specific print media queries:
```css
@media print {
  @page { size: A4; margin: 10mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}
```

---

## 💾 Backend Implementation Rules

### 1. Permanent Deletion
When a **Delete** action is triggered, ensure the record is physically deleted from the database (or soft-deleted if the schema explicitly requires it) and all related file assets are considered for cleanup.

### 2. Permission Enforcement
Always wrap these actions with the RBAC rules defined above.


---

## 🗄️ Database Schema & Migration Standards

To prevent "missing column" errors after adding new features or fields, you MUST follow these steps to synchronize the database with your schema.

### 1. Update Schema
Define your new table or field in `db/schema/`.

### 2. Push Changes (Simple Sync)
For rapid development, you can sync the database schema directly:
```bash
npm run db:push
```
> [!WARNING]
> This command will attempt to synchronize your database with your schema files. It may prompt for confirmation if changes involve data loss.

### 3. Generate Migrations (Production/Stable)
If you need a record of the change (migration file), use:
```bash
npm run db:generate
```
This will create a new `.sql` file in the `drizzle/` directory.

### 4. Verification Step (MANDATORY)
After pushing or migrating, ALWAYS verify that the database reflected your changes. You can run a quick check using a script or the Drizzle Studio:
```bash
npm run db:studio
```
Or use a verification script like the one in `scripts/verify-columns.ts` (if available) to list table columns.

### 5. Common Troubleshooting
- **Missing Columns in App**: If the app still complains about missing columns after `db:push`, restart your dev server to clear the Drizzle metadata cache.
- **Drizzle Hub/Studio Issues**: If Drizzle Studio doesn't show your changes, ensure your `drizzle.config.ts` points to the correct database URL and schema location.

---

## 🗂️ Table & Virtualization Standards

To ensure high performance and visual consistency across all dashboard tables, all new tables MUST follow the standardized TanStack Virtualization pattern.

### 1. Structure & Container
- Use a wrapper with `rounded-md border bg-card overflow-hidden`.
- Use a `parentRef` container with a fixed height (e.g., `h-[600px]`) and `overflow-auto relative`.
- Apply `scrollbar-thin scrollbar-thumb-accent` for consistent scrollbar styling.

### 2. Standardized Virtualization Pattern
Always calculate `before` and `after` padding rows to ensure smooth scrolling and no border glitches.

```tsx
const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Adjust based on row height
    overscan: 20,
})

const [before, after] = rowVirtualizer.getVirtualItems().length > 0
    ? [
        rowVirtualizer.getVirtualItems()[0].start,
        rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
    ]
    : [0, 0]

return (
    <Table>
        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
            {/* ... headers ... */}
        </TableHeader>
        <TableBody>
            {rowVirtualizer.getVirtualItems().length > 0 ? (
                <>
                    {/* Padding Row Before */}
                    <TableRow style={{ height: `${before}px` }} className="border-none">
                        <TableCell colSpan={columns.length} className="p-0" />
                    </TableRow>
                    
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index]
                        return (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        )
                    })}
                    
                    {/* Padding Row After */}
                    <TableRow style={{ height: `${after}px` }} className="border-none">
                        <TableCell colSpan={columns.length} className="p-0" />
                    </TableRow>
                </>
            ) : (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                    </TableCell>
                </TableRow>
            )}
        </TableBody>
    </Table>
)
```

### 3. Key Requirements
- **Sticky Headers**: MUST use `sticky top-0 z-10 bg-background shadow-sm` on the `TableHeader`.
- **Border-None Padding**: MUST use `className="border-none"` on the `before`/`after` `TableRow` to prevent flickering double-borders.
- **Zero Padding Cells**: MUST use `className="p-0"` on the `TableCell` inside padding rows.
