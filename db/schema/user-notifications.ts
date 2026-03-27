import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

import { user } from "./auth"
import { emailLogs } from "./email"

export const userNotificationReads = pgTable("user_notification_reads", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    emailLogId: text("email_log_id").notNull().references(() => emailLogs.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    unique("user_notification_reads_user_log_unique").on(table.userId, table.emailLogId),
    index("user_notification_reads_user_idx").on(table.userId),
    index("user_notification_reads_log_idx").on(table.emailLogId),
])
