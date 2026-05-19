import "dotenv/config"
import { Pool } from "pg"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instagram_image_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        prompt text NOT NULL,
        enhanced_prompt text,
        format text NOT NULL,
        content_type text NOT NULL,
        visual_style text NOT NULL,
        width integer NOT NULL,
        height integer NOT NULL,
        mime_type text NOT NULL DEFAULT 'image/png',
        size_bytes integer,
        image_url text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        download_count integer NOT NULL DEFAULT 0
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_instagram_image_history_user_id
      ON instagram_image_history(user_id, created_at DESC)
    `)
    console.log("Migration instagram_image_history berhasil")
  } catch (err) {
    console.error("Migration gagal:", err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
