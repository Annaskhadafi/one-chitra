import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const instagramImageHistory = pgTable("instagram_image_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  enhancedPrompt: text("enhanced_prompt"),
  format: text("format").notNull(), // feed, portrait, story
  contentType: text("content_type").notNull(),
  visualStyle: text("visual_style").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  mimeType: text("mime_type").notNull().default("image/png"),
  sizeBytes: integer("size_bytes"),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  downloadCount: integer("download_count").notNull().default(0),
})
