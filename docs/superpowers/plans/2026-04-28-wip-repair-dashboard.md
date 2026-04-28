# WIP Repair Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a colorful, interactive WIP Repair dashboard that turns existing WO header and detail-material API data into operational insight.

**Architecture:** Keep the existing WIP Repair table intact. Add a tested aggregation module in `lib/wip-repair-dashboard.ts`, a client visualization component under the new dashboard route, and a server page that fetches the same two APIs already used by WIP Repair.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Recharts, existing shadcn-style UI primitives.

---

### Task 1: Aggregation Logic

**Files:**
- Create: `lib/wip-repair-dashboard.ts`
- Test: `lib/__tests__/wip-repair-dashboard.test.ts`

- [x] **Step 1: Write failing tests**

Add tests for total WO, status, injury, material quantities, job time, aging, and work-order drilldown coverage.

- [x] **Step 2: Run tests and verify RED**

Run: `npx vitest --run lib/__tests__/wip-repair-dashboard.test.ts`

Expected: fail because `buildWipRepairDashboardData` does not exist.

- [x] **Step 3: Implement aggregation**

Implement pure functions that normalize blank values, group top-N values, parse numeric quantity/time fields, join detail rows by `wo`, and return dashboard-ready arrays.

- [x] **Step 4: Run tests and verify GREEN**

Run: `npx vitest --run lib/__tests__/wip-repair-dashboard.test.ts`

Expected: pass.

### Task 2: Dashboard UI

**Files:**
- Create: `app/dashboard/wip-repair/dashboard/_components/wip-repair-dashboard-client.tsx`
- Create: `app/dashboard/wip-repair/dashboard/page.tsx`

- [x] **Step 1: Add client dashboard**

Build filterable cards, charts, material ranking, injury/customer/site analysis, process-time panels, and drilldown table.

- [x] **Step 2: Add server route**

Fetch WIP Repair header and detail APIs, build dashboard data on the server, and pass it into the client component.

### Task 3: Navigation

**Files:**
- Modify: `lib/navigation.ts`

- [x] **Step 1: Add submenu item**

Add `WIP Dashboard` under the existing Central Services -> WIP Repair group, while keeping the current table route available.

### Task 4: Verification

**Files:**
- Validate changed TypeScript and tests.

- [x] **Step 1: Run targeted test**

Run: `npx vitest --run lib/__tests__/wip-repair-dashboard.test.ts`

- [x] **Step 2: Run typecheck**

Run: `npm run check-types`

If repo-wide typecheck fails on existing unrelated files, report the exact blocker and keep the dashboard test result explicit.
