// GET /api/storage/usage — 返回当前用户的存储占用与配额（配额来自 D1 设置，默认 1TB）
import { db } from '@nuxthub/db'
import { files, userSettings } from '../../database/schema'
import { and, eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  // 真实占用 = 当前用户未删除文件（files 表）的大小总和；移入回收站即从 files 表删除，不计入
  const [row] = await db.select({
    used: sql<number>`COALESCE(SUM(${files.size}), 0)`
  }).from(files).where(eq(files.userId, userId))

  // 配额：测试用户固定 100MB；其他优先读取用户设置的 storageLimit（0 表示无限制），默认 1TB
  let limit = 1024 * 1024 * 1024 * 1024
  if (userId === TEST_USER_ID) {
    limit = TEST_USER_LIMIT
  } else {
    const limitRow = await db.select().from(userSettings)
      .where(and(eq(userSettings.userId, userId), eq(userSettings.key, 'storageLimit')))
      .limit(1)
    if (limitRow[0]) {
      try {
        const v = Number(JSON.parse(limitRow[0].value))
        if (Number.isFinite(v) && v >= 0) limit = v
      } catch {
        // 使用默认值
      }
    }
  }

  return {
    used: Number(row?.used ?? 0),
    limit
  }
})
