import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { rfidScans } from "./rfid-scans";

export const rfidDamagePhotos = pgTable("rfid_damage_photos", {
    id: serial("id").primaryKey(),
    photoId: varchar("photo_id", { length: 100 }).notNull().unique(),
    sn: varchar("sn", { length: 100 }).notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    url: text("url").notNull(),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    rfidScanId: integer("rfid_scan_id").references(() => rfidScans.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rfidDamagePhotosRelations = relations(rfidDamagePhotos, ({ one }) => ({
    rfidScan: one(rfidScans, {
        fields: [rfidDamagePhotos.rfidScanId],
        references: [rfidScans.id],
    }),
}));
