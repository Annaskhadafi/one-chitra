import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { roles } from "./roles";
import { permissions } from "./permissions";

export const rolePermissions = pgTable("role_permissions", {
    roleId: integer("role_id").references(() => roles.id, { onDelete: 'cascade' }).notNull(),
    permissionId: integer("permission_id").references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
]);
