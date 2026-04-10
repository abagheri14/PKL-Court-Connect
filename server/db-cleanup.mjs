/**
 * Pre-push database cleanup script.
 * Runs BEFORE drizzle-kit push to resolve orphaned/renamed tables
 * so that drizzle doesn't prompt about create vs rename.
 *
 * Usage: node server/db-cleanup.mjs
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log("[db-cleanup] No DATABASE_URL set, skipping cleanup.");
  process.exit(0);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  try {
    // Check for orphaned pkl_groups table (renamed in a prior migration)
    const [rows] = await conn.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pkl_groups'"
    );

    if (Array.isArray(rows) && rows.length > 0) {
      // Check if the canonical 'groups' table already exists
      const [groupsRows] = await conn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups'"
      );

      if (Array.isArray(groupsRows) && groupsRows.length > 0) {
        // Both exist — drop the orphan
        console.log("[db-cleanup] Dropping orphaned 'pkl_groups' table (canonical 'groups' already exists).");
        await conn.execute("DROP TABLE IF EXISTS `pkl_groups`");
      } else {
        // Only pkl_groups exists — rename it back to groups
        console.log("[db-cleanup] Renaming 'pkl_groups' back to 'groups'.");
        await conn.execute("RENAME TABLE `pkl_groups` TO `groups`");
      }
    } else {
      console.log("[db-cleanup] No orphaned tables found.");
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[db-cleanup] Error:", err.message);
  // Don't fail the deploy — db:push will handle table creation
  process.exit(0);
});
