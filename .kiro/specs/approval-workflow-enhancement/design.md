# Design Document: Approval Workflow Enhancement

## Overview

Enhancement ini merefaktor halaman approval yang sudah ada menjadi sistem yang lebih lengkap dengan navigasi tab (Inbox, Status, Reports), layout detail dua kolom dengan Action Panel, Timeline aktivitas, Workflow Canvas dengan drag-reorder, dan empat tipe step baru. Semua perubahan bersifat additive — tidak menghapus fungsionalitas yang sudah ada.

### Current State

- `app/dashboard/approvals/page.tsx` — server component, dua card terpisah (Pending Tasks + My Submissions), tidak ada tab
- `app/dashboard/approvals/[requestId]/page.tsx` — single column, iframe embed form, assignments table, audit trail sederhana
- `app/actions/approval.ts` — 3221 baris, sudah ada `getApprovalInbox`, `getApprovalRequestDetail`, `submitApprovalDecision`
- Schema DB sudah mendukung `conditionJson` dengan berbagai `nodeKind`

### Enhancement Goals

1. Tab navigation (Inbox / Status / Reports) dengan URL search param persistence
2. Inbox tab — tabel informatif dengan badge count
3. Status tab — filter, search, bulk action, export CSV/XLSX
4. Detail page — layout dua kolom, Action Panel, workflowNotePolicy validation
5. Timeline component — audit log kronologis dengan visual per action type
6. Workflow Canvas — tabel step + drag-and-drop reorder
7. Step Types — 4 tipe step dengan form konfigurasi masing-masing
8. Reports tab — statistik dan bottleneck analysis
9. Server actions baru untuk semua fitur di atas

---

## Architecture

### Component Tree

```
app/dashboard/approvals/
├── page.tsx                          ← Client Component (tab shell, URL param)
│   ├── _components/
│   │   ├── inbox-tab.tsx             ← Server Component (data fetch + table)
│   │   ├── status-tab.tsx            ← Client Component (filter state + table)
│   │   ├── reports-tab.tsx           ← Client Component (date filter + stats)
│   │   └── action-panel.tsx          ← Client Component (approve/reject/revert)
│   └── [requestId]/
│       ├── page.tsx                  ← Server Component (2-col layout)
│       └── _components/
│           └── timeline.tsx          ← Client Component (audit log visual)
└── matrix/
    ├── page.tsx                      ← Server Component (existing + canvas)
    └── _components/
        ├── workflow-canvas.tsx       ← Client Component (dnd-kit table)
        ├── step-type-selector.tsx    ← Client Component (modal pilih tipe)
        └── step-config-form.tsx      ← Client Component (form per tipe step)
```

### Data Flow

```
URL (?tab=inbox|status|reports)
  └─► page.tsx (client, reads searchParams)
        ├─► <InboxTab />   ← getApprovalInbox() [existing]
        ├─► <StatusTab />  ← getApprovalStatusList(filters) [new]
        └─► <ReportsTab /> ← getApprovalReports(dateRange) [new]

[requestId]/page.tsx (server)
  ├─► getApprovalRequestDetail(requestId) [existing]
  ├─► Left col: conditionSnapshot fields + <Timeline />
  └─► Right col: <ActionPanel /> ← submitApprovalDecision / revertApprovalRequest

matrix/page.tsx (server)
  └─► <WorkflowCanvas />
        ├─► reorderWorkflowSteps(definitionId, stepOrders) [new]
        ├─► updateWorkflowStep(stepId, config) [new]
        └─► addWorkflowStep(definitionId, stepType, config) [new]
```

### State Management Strategy

- Tab aktif: `?tab=` URL search param (persist across navigation)
- Status tab filters: local `useState` + URL search params untuk shareable URL
- Drag-and-drop order: optimistic update di client, server action untuk persist
- Action Panel: `useTransition` + `useOptimistic` untuk feedback tanpa full reload

---

## Components and Interfaces

### 1. `page.tsx` — Tab Shell (Client Component)

```tsx
// Reads ?tab= from searchParams, renders tab nav + active tab content
// Uses shadcn Tabs component
type TabValue = "inbox" | "status" | "reports"
```

### 2. `inbox-tab.tsx` — Inbox Tab

```tsx
type InboxTabProps = {
  pendingTasks: PendingTask[]  // dari getApprovalInbox()
}

type PendingTask = {
  assignmentId: string
  requestId: string
  formKey: string
  submitterName: string       // resolved dari requesterId → user.name
  stepName: string
  stepOrder: number
  submittedAt: Date
}
```

Kolom tabel: ID (requestId truncated), Form, Submitter, Step, Submitted. Klik baris → `router.push(/dashboard/approvals/${requestId})`.

### 3. `status-tab.tsx` — Status Tab (Client Component)

```tsx
type StatusFilter = {
  status: "all" | "pending" | "approved" | "rejected" | "cancelled"
  search: string              // by requestId
  dateFrom: string | null
  dateTo: string | null
  formKey: string | null
}

type StatusTabProps = {
  initialData: ApprovalStatusItem[]
  formKeyOptions: string[]
}
```

Filter state di-sync ke URL params. Export menggunakan `xlsx` library (sudah ada di project).

### 4. `reports-tab.tsx` — Reports Tab (Client Component)

```tsx
type ReportsData = {
  byStatus: { pending: number; approved: number; rejected: number; cancelled: number }
  avgCompletionDays: number | null
  stepBottlenecks: { stepName: string; pendingCount: number }[]
}
```

### 5. `[requestId]/page.tsx` — Detail Page (2-col layout)

```tsx
// Left col (lg:col-span-2):
//   - conditionSnapshot fields rendered sebagai key-value pairs
//   - <Timeline auditLogs={detail.auditLogs} />
//
// Right col (lg:col-span-1):
//   - Entry ID, Submitted, Status badges
//   - <ActionPanel request={detail} currentUserId={session.user.id} />
```

Responsive: `grid-cols-1 lg:grid-cols-3`. Di bawah 1024px, panel kanan pindah ke bawah.

### 6. `action-panel.tsx` — Action Panel (Client Component)

```tsx
type ActionPanelProps = {
  requestId: string
  requestStatus: "pending" | "approved" | "rejected" | "cancelled"
  requesterId: string
  currentUserId: string
  isAssignedApprover: boolean
  workflowNotePolicy: "optional" | "required_on_approve" | "required_on_reject" | "required_always"
  hasAnyApproverDecision: boolean  // untuk guard tombol Revert
}
```

Logic tombol:
- Approve/Reject: tampil jika `isAssignedApprover && status === "pending"`
- Revert: tampil jika `currentUserId === requesterId && status === "pending" && !hasAnyApproverDecision`
- Comment input: selalu tampil, validasi sesuai `workflowNotePolicy`

### 7. `timeline.tsx` — Timeline Component (Client Component)

```tsx
type TimelineEntry = {
  id: string
  action: "submitted" | "approved" | "rejected" | "reverted" | "commented" | "escalate" | "cancel"
  actorName: string
  createdAt: Date
  comment?: string | null
}

type TimelineProps = {
  entries: TimelineEntry[]
}
```

Visual: vertical line dengan dot berwarna per action type. Warna: submitted=blue, approved=green, rejected=red, reverted=orange, commented=gray.

### 8. `workflow-canvas.tsx` — Workflow Canvas (Client Component)

```tsx
type WorkflowStep = {
  id: number
  stepOrder: number
  stepName: string
  stepType: UIStepType        // "approval" | "notification" | "update_user" | "user_input"
  entriesCount: number        // jumlah request yang pernah melewati step ini
  conditionJson: Record<string, unknown>
}

type UIStepType = "approval" | "notification" | "update_user" | "user_input"
```

Menggunakan `@dnd-kit/core` + `@dnd-kit/sortable` untuk drag-and-drop. Fallback message untuk touch devices.

### 9. `step-config-form.tsx` — Step Config Form

Form berbeda per `UIStepType`:

| Step Type | Fields |
|-----------|--------|
| Approval | approverType (role/user), approverRole/approverUserId, minApprovals, workflowNotePolicy |
| Notification | recipients (email/role), messageTemplate |
| Update_User | targetField, newValue (bisa dari snapshot field) |
| User_Input | inputFields[] (key, label, type, required) |

---

## Data Models

### Extended `conditionJson` Schema

```typescript
// Base (semua step type)
type BaseStepConfig = {
  nodeKind: WorkflowNodeKind
  instructions?: string
}

// Approval step (existing + extended)
type ApprovalStepConfig = BaseStepConfig & {
  nodeKind: "approvalStep"
  workflowNotePolicy?: "optional" | "required_on_approve" | "required_on_reject" | "required_always"
}

// Notification step (new UI type)
type NotificationStepConfig = BaseStepConfig & {
  nodeKind: "notifyNode"
  recipients: string[]          // email addresses atau role names
  messageTemplate: string
}

// Update User step (new UI type — maps to existing autoApproveNode or custom)
type UpdateUserStepConfig = BaseStepConfig & {
  nodeKind: "updateUserNode"    // new nodeKind
  targetField: string
  newValue: string              // bisa literal atau "{{snapshot.fieldKey}}"
}

// User Input step (new UI type)
type UserInputStepConfig = BaseStepConfig & {
  nodeKind: "userInputNode"     // new nodeKind
  inputFields: {
    key: string
    label: string
    type: "text" | "number" | "date" | "select"
    required: boolean
    options?: string[]          // untuk type "select"
  }[]
}
```

### New Server Action Return Types

```typescript
// getApprovalStatusList
type ApprovalStatusItem = {
  requestId: string
  formKey: string
  definitionName: string
  requesterId: string
  requesterName: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  currentStepOrder: number | null
  submittedAt: Date
  completedAt: Date | null
}

// getApprovalReports
type ApprovalReportsData = {
  byStatus: Record<string, number>
  avgCompletionDays: number | null
  stepBottlenecks: { stepName: string; stepOrder: number; pendingCount: number }[]
  dateRange: { from: Date | null; to: Date | null }
}

// reorderWorkflowSteps input
type StepReorderItem = {
  stepId: number
  newStepOrder: number
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: workflowNotePolicy — Approve requires comment

*For any* approval request where the active step's `workflowNotePolicy` is `"required_on_approve"` or `"required_always"`, submitting an approve action with an empty or whitespace-only comment must be rejected and the request status must remain unchanged.

**Validates: Requirements 4.8, 4.10**

### Property 2: workflowNotePolicy — Reject requires comment

*For any* approval request where the active step's `workflowNotePolicy` is `"required_on_reject"` or `"required_always"`, submitting a reject action with an empty or whitespace-only comment must be rejected and the request status must remain unchanged.

**Validates: Requirements 4.9, 4.10**

### Property 3: Revert guard — no approver decision

*For any* approval request, the revert action must only succeed when: (a) the caller is the original submitter, (b) the request status is `"pending"`, and (c) no assignment in the request has status `"approved"` or `"rejected"`. If any of these conditions is false, the revert must be rejected.

**Validates: Requirements 9.1, 9.5**

### Property 4: Status filter subset correctness

*For any* set of approval requests and any combination of active filters (status, search, dateFrom, dateTo, formKey), the returned list must be a subset of all requests, and every item in the returned list must satisfy all active filter criteria simultaneously.

**Validates: Requirements 3.7, 3.8**

### Property 5: Step reorder validity

*For any* workflow definition with N steps, after a reorder operation the resulting step list must: (a) contain exactly the same N step IDs as before, (b) have no duplicate `stepOrder` values, and (c) have all `stepOrder` values be positive integers.

**Validates: Requirements 6.2, 6.3**

### Property 6: Timeline chronological order

*For any* approval request, the timeline entries returned must be ordered from oldest to newest by `createdAt`, and the set of entries must be identical to the full audit log for that request.

**Validates: Requirements 5.1, 5.2**

---

## Error Handling

### Client-Side Validation

- `action-panel.tsx` validates `workflowNotePolicy` before calling server action — shows inline error message, does not submit
- `step-config-form.tsx` validates required fields per step type before saving — highlights missing fields per Requirement 7.7
- `workflow-canvas.tsx` shows toast on drag-reorder failure and reverts optimistic update

### Server-Side Validation

- `revertApprovalRequest`: returns `{ success: false, error: "..." }` if caller is not submitter, status is not pending, or any assignment has a decision
- `submitApprovalDecision` (existing): already validates assignment ownership; extend to validate `workflowNotePolicy`
- `reorderWorkflowSteps`: validates no duplicate stepOrders, all stepIds belong to the definition
- `addWorkflowStep` / `updateWorkflowStep`: validates required config fields per nodeKind

### Error Response Pattern

All new server actions follow the existing pattern:

```typescript
type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }
```

### Not Found / Unauthorized

- Detail page: `notFound()` if `getApprovalRequestDetail` returns null (existing behavior preserved)
- All server actions: `getAuthenticatedSession()` throws redirect to login if unauthenticated

---

## Testing Strategy

### Unit Tests

Focus pada logika yang tidak memerlukan database:

- `workflowNotePolicy` validation logic (pure function)
- `hasAnyApproverDecision` computation dari assignments array
- Timeline entry sorting dan formatting
- Step reorder validation (no duplicates, all IDs present)
- Status filter predicate logic

### Property-Based Tests

Menggunakan **fast-check** (sudah tersedia di project berdasarkan `package.json`). Minimum 100 iterasi per property test.

Setiap property test diberi tag komentar:
```
// Feature: approval-workflow-enhancement, Property N: <property_text>
```

**Property 1 test**: Generate random `workflowNotePolicy` values dan random comment strings (termasuk whitespace-only). Verifikasi bahwa `validateNotePolicy(policy, comment, action)` mengembalikan `false` tepat ketika policy mensyaratkan comment dan comment kosong/whitespace.

**Property 2 test**: Sama dengan Property 1 untuk aksi reject.

**Property 3 test**: Generate random `ApprovalRequest` dengan random `assignments[]`. Verifikasi bahwa `canRevert(request, assignments, userId)` mengembalikan `true` hanya ketika semua tiga kondisi terpenuhi.

**Property 4 test**: Generate random array `ApprovalStatusItem[]` dan random `StatusFilter`. Verifikasi bahwa setiap item dalam hasil `applyStatusFilters(items, filter)` memenuhi semua kriteria filter yang aktif, dan hasilnya adalah subset dari input.

**Property 5 test**: Generate random array step IDs dan random permutasi `stepOrder`. Verifikasi bahwa `validateStepReorder(original, reordered)` mengembalikan valid hanya ketika semua kondisi terpenuhi (same IDs, no duplicates, positive integers).

**Property 6 test**: Generate random array `AuditLog[]` dengan random `createdAt`. Verifikasi bahwa `sortTimelineEntries(entries)` menghasilkan array yang terurut ascending by `createdAt` dan memiliki panjang yang sama dengan input.

### Integration Tests (Example-Based)

- Render `<ActionPanel />` dengan berbagai kombinasi props → verifikasi tombol yang tampil
- Render `<Timeline />` dengan empty entries → verifikasi empty state message
- `getApprovalStatusList` dengan filter aktif → verifikasi query SQL yang dihasilkan
- `revertApprovalRequest` dengan request yang sudah ada keputusan → verifikasi error response
