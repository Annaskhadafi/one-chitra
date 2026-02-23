import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { user } from "./auth"

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "marketing",
  "reminder",
])

export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  allDay: boolean("all_day").default(false).notNull(),
  type: calendarEventTypeEnum("type").default("marketing").notNull(),
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  relatedCustomerId: integer("related_customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  // Email reminder
  emailReminderAt: timestamp("email_reminder_at", { withTimezone: true }),
  emailReminderSent: boolean("email_reminder_sent").default(false).notNull(),
  emailReminderTo: varchar("email_reminder_to", { length: 255 }),
  // Audit
  createdBy: varchar("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
