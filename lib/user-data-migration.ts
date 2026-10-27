import type { PoolClient } from "pg"

export async function migrateLegacyUserData(
  client: PoolClient,
  stableUserId: string,
  legacyUserIds: string[]
) {
  for (const legacyUserId of new Set(legacyUserIds)) {
    if (!legacyUserId || legacyUserId === stableUserId) continue

    await client.query(
      `UPDATE transactions
       SET "userId" = $1
       WHERE "userId" = $2`,
      [stableUserId, legacyUserId]
    )

    await client.query(
      `INSERT INTO stock_positions ("userId", "symbol", "label", "shares", "avgPrice", "avgFxRate", "createdAt")
       SELECT $1, "symbol", "label", "shares", "avgPrice", "avgFxRate", "createdAt"
       FROM stock_positions
       WHERE "userId" = $2
       ON CONFLICT ("userId", "symbol") DO UPDATE SET
         "shares" = CASE
           WHEN stock_positions."shares" IS NULL THEN EXCLUDED."shares"
           WHEN EXCLUDED."shares" IS NULL THEN stock_positions."shares"
           ELSE stock_positions."shares" + EXCLUDED."shares"
         END,
         "avgPrice" = CASE
           WHEN stock_positions."shares" IS NULL OR stock_positions."avgPrice" IS NULL
             THEN COALESCE(stock_positions."avgPrice", EXCLUDED."avgPrice")
           WHEN EXCLUDED."shares" IS NULL OR EXCLUDED."avgPrice" IS NULL
             THEN stock_positions."avgPrice"
           WHEN stock_positions."shares" + EXCLUDED."shares" = 0
             THEN stock_positions."avgPrice"
           ELSE (
             stock_positions."shares" * stock_positions."avgPrice" +
             EXCLUDED."shares" * EXCLUDED."avgPrice"
           ) / (stock_positions."shares" + EXCLUDED."shares")
         END,
         "avgFxRate" = CASE
           WHEN stock_positions."shares" IS NULL OR stock_positions."avgFxRate" IS NULL
             THEN COALESCE(stock_positions."avgFxRate", EXCLUDED."avgFxRate")
           WHEN EXCLUDED."shares" IS NULL OR EXCLUDED."avgFxRate" IS NULL
             THEN stock_positions."avgFxRate"
           WHEN stock_positions."shares" + EXCLUDED."shares" = 0
             THEN stock_positions."avgFxRate"
           ELSE (
             stock_positions."shares" * stock_positions."avgFxRate" +
             EXCLUDED."shares" * EXCLUDED."avgFxRate"
           ) / (stock_positions."shares" + EXCLUDED."shares")
         END`,
      [stableUserId, legacyUserId]
    )

    await client.query(
      `DELETE FROM stock_positions
       WHERE "userId" = $1`,
      [legacyUserId]
    )
  }
}
