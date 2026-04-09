/**
 * Pre-migration script: renames `groups` → `pkl_groups` if needed.
 * MySQL treats `groups` as a reserved word, so we renamed the table.
 * drizzle-kit push can't handle renames non-interactively, so this
 * script performs the rename before push runs.
 */
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[pre-migrate] No DATABASE_URL, skipping.");
    return;
  }

  const conn = await mysql.createConnection(url);
  try {
    // Check if old `groups` table exists
    const [rows] = await conn.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups'"
    );
    if (Array.isArray(rows) && rows.length > 0) {
      // Check if pkl_groups already exists (avoid conflict)
      const [pklRows] = await conn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pkl_groups'"
      );
      if (Array.isArray(pklRows) && pklRows.length === 0) {
        console.log("[pre-migrate] Renaming `groups` → `pkl_groups`...");
        await conn.execute("RENAME TABLE `groups` TO `pkl_groups`");
        console.log("[pre-migrate] Done.");
      } else {
        console.log("[pre-migrate] Both `groups` and `pkl_groups` exist — skipping rename. Drop `groups` manually if needed.");
      }
    } else {
      console.log("[pre-migrate] No `groups` table found, nothing to rename.");
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[pre-migrate] Error:", err.message);
  process.exit(1);
});
