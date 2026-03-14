import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { stockLevels, user, userWarehouseAccess, warehouses } from "@/db/schema";
import { getAuthenticatedSession } from "@/lib/rbac";

export type WarehouseAccessLevel = "view" | "edit";
export type WarehouseAccessAction = "view" | "edit";

export type WarehouseScopeAssignment = {
    warehouseId: number;
    accessLevel: WarehouseAccessLevel;
    warehouse: {
        id: number;
        sloc: string;
        description: string | null;
        type: string | null;
    } | null;
};

export type WarehouseAccessContext = {
    userId: string;
    role: string | null;
    isGlobal: boolean;
    hasExplicitAssignments: boolean;
    warehouseIds: number[];
    assignments: WarehouseScopeAssignment[];
};

type WarehouseAccessExecutor = Pick<typeof db, "delete" | "insert">;

const GLOBAL_WAREHOUSE_ROLES = new Set(["admin", "superuser"]);
let ensureUserWarehouseAccessTablePromise: Promise<void> | null = null;

function normalizeRole(role?: string | null) {
    return (role || "").trim().toLowerCase();
}

function isMissingUserWarehouseAccessTableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes("user_warehouse_access");
}

async function ensureUserWarehouseAccessTable() {
    if (!ensureUserWarehouseAccessTablePromise) {
        ensureUserWarehouseAccessTablePromise = (async () => {
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "user_warehouse_access" (
                    "id" serial PRIMARY KEY,
                    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
                    "warehouse_id" integer NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
                    "access_level" varchar(10) DEFAULT 'edit' NOT NULL,
                    "created_at" timestamp DEFAULT now() NOT NULL,
                    "updated_at" timestamp DEFAULT now() NOT NULL,
                    CONSTRAINT "user_warehouse_access_user_warehouse_unique" UNIQUE("user_id", "warehouse_id")
                );
            `);
        })().finally(() => {
            ensureUserWarehouseAccessTablePromise = null;
        });
    }

    await ensureUserWarehouseAccessTablePromise;
}

export function hasGlobalWarehouseAccess(role?: string | null) {
    return GLOBAL_WAREHOUSE_ROLES.has(normalizeRole(role));
}

export function normalizeWarehouseAccessInput(
    accesses: Array<{ warehouseId: number; accessLevel?: WarehouseAccessLevel | null }>
) {
    const deduped = new Map<number, WarehouseAccessLevel>();

    for (const access of accesses) {
        if (!Number.isInteger(access.warehouseId) || access.warehouseId <= 0) {
            continue;
        }

        const nextLevel: WarehouseAccessLevel = access.accessLevel === "view" ? "view" : "edit";
        const currentLevel = deduped.get(access.warehouseId);

        if (currentLevel === "edit" || nextLevel === "edit") {
            deduped.set(access.warehouseId, "edit");
            continue;
        }

        deduped.set(access.warehouseId, nextLevel);
    }

    return Array.from(deduped.entries()).map(([warehouseId, accessLevel]) => ({
        warehouseId,
        accessLevel,
    }));
}

export async function getUserWarehouseAssignments(userId: string): Promise<WarehouseScopeAssignment[]> {
    const runQuery = async () => db.query.userWarehouseAccess.findMany({
        where: eq(userWarehouseAccess.userId, userId),
        with: {
            warehouse: {
                columns: {
                    id: true,
                    sloc: true,
                    description: true,
                    type: true,
                },
            },
        },
        orderBy: [asc(userWarehouseAccess.warehouseId)],
    });

    try {
        const rows = await runQuery();

        return rows.map((row) => ({
            warehouseId: row.warehouseId,
            accessLevel: row.accessLevel === "view" ? "view" : "edit",
            warehouse: row.warehouse
                ? {
                    id: row.warehouse.id,
                    sloc: row.warehouse.sloc,
                    description: row.warehouse.description,
                    type: row.warehouse.type,
                }
                : null,
        }));
    } catch (error) {
        if (!isMissingUserWarehouseAccessTableError(error)) {
            throw error;
        }

        await ensureUserWarehouseAccessTable();
        const rows = await runQuery();

        return rows.map((row) => ({
            warehouseId: row.warehouseId,
            accessLevel: row.accessLevel === "view" ? "view" : "edit",
            warehouse: row.warehouse
                ? {
                    id: row.warehouse.id,
                    sloc: row.warehouse.sloc,
                    description: row.warehouse.description,
                    type: row.warehouse.type,
                }
                : null,
        }));
    }
}

export async function getWarehouseAccessContextForUserId(
    userId: string,
    action: WarehouseAccessAction = "view"
): Promise<WarehouseAccessContext> {
    const dbUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: {
            id: true,
            role: true,
        },
    });

    if (!dbUser) {
        return {
            userId,
            role: null,
            isGlobal: true,
            hasExplicitAssignments: false,
            warehouseIds: [],
            assignments: [],
        };
    }

    const assignments = await getUserWarehouseAssignments(dbUser.id);

    if (hasGlobalWarehouseAccess(dbUser.role) || assignments.length === 0) {
        return {
            userId: dbUser.id,
            role: dbUser.role,
            isGlobal: true,
            hasExplicitAssignments: assignments.length > 0,
            warehouseIds: [],
            assignments,
        };
    }

    const warehouseIds = Array.from(new Set(
        assignments
            .filter((assignment) => action === "view" || assignment.accessLevel === "edit")
            .map((assignment) => assignment.warehouseId)
    ));

    return {
        userId: dbUser.id,
        role: dbUser.role,
        isGlobal: false,
        hasExplicitAssignments: true,
        warehouseIds,
        assignments,
    };
}

export async function getCurrentUserWarehouseAccessContext(
    action: WarehouseAccessAction = "view"
) {
    const session = await getAuthenticatedSession();
    return getWarehouseAccessContextForUserId(session.user.id, action);
}

export async function assertCurrentUserHasWarehouseAccess(
    warehouseId: number,
    action: WarehouseAccessAction = "view"
) {
    const context = await getCurrentUserWarehouseAccessContext(action);

    if (!context.isGlobal && !context.warehouseIds.includes(warehouseId)) {
        throw new Error("Warehouse access denied");
    }

    return context;
}

export async function assertCurrentUserHasWarehouseAccessForAll(
    warehouseIds: number[],
    action: WarehouseAccessAction = "view"
) {
    const uniqueWarehouseIds = Array.from(new Set(warehouseIds.filter((warehouseId) => Number.isInteger(warehouseId))));
    const context = await getCurrentUserWarehouseAccessContext(action);

    if (!context.isGlobal) {
        const unauthorizedWarehouseId = uniqueWarehouseIds.find((warehouseId) => !context.warehouseIds.includes(warehouseId));

        if (unauthorizedWarehouseId) {
            throw new Error("Warehouse access denied");
        }
    }

    return context;
}

export async function getAllowedWarehouseIdsForCurrentUser(
    action: WarehouseAccessAction = "view"
) {
    const context = await getCurrentUserWarehouseAccessContext(action);
    return context.isGlobal ? null : context.warehouseIds;
}

export async function replaceUserWarehouseAccess(
    executor: WarehouseAccessExecutor,
    userId: string,
    accesses: Array<{ warehouseId: number; accessLevel?: WarehouseAccessLevel | null }>
) {
    const normalizedAccesses = normalizeWarehouseAccessInput(accesses);

    try {
        await executor.delete(userWarehouseAccess).where(eq(userWarehouseAccess.userId, userId));
    } catch (error) {
        if (!isMissingUserWarehouseAccessTableError(error)) {
            throw error;
        }

        await ensureUserWarehouseAccessTable();
        await executor.delete(userWarehouseAccess).where(eq(userWarehouseAccess.userId, userId));
    }

    if (normalizedAccesses.length === 0) {
        return normalizedAccesses;
    }

    await executor.insert(userWarehouseAccess).values(
        normalizedAccesses.map((access) => ({
            userId,
            warehouseId: access.warehouseId,
            accessLevel: access.accessLevel,
            updatedAt: new Date(),
        }))
    );

    return normalizedAccesses;
}

export async function getWarehouseIdsForStockIds(stockIds: number[]) {
    if (stockIds.length === 0) {
        return [];
    }

    const rows = await db.query.stockLevels.findMany({
        where: inArray(stockLevels.id, stockIds),
        columns: {
            warehouseId: true,
        },
    });

    return rows.map((row) => row.warehouseId);
}

export async function getAccessibleWarehousesForCurrentUser(
    action: WarehouseAccessAction = "view"
) {
    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser(action);

    if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
        return [];
    }

    return db.query.warehouses.findMany({
        where: allowedWarehouseIds ? inArray(warehouses.id, allowedWarehouseIds) : undefined,
        orderBy: [asc(warehouses.description), asc(warehouses.sloc)],
    });
}
