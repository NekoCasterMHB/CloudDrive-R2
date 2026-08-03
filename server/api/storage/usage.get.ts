// GET /api/storage/usage — 返回当前用户的存储占用与配额（配额来自用户组/个人设置，默认 1TB）
import { db } from '@nuxthub/db'
import { files, userSettings } from '../../database/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getUserGroup } from '../../utils/group'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  // 真实占用 = 当前用户未删除文件（files 表）的大小总和；移入回收站即从 files 表删除，不计入
  const [row] = await db.select({
    used: sql<number>`COALESCE(SUM(${files.size}), 0)`
  }).from(files).where(eq(files.userId, userId))

  // 配额优先级：测试用户固定 100MB → 用户组 storageLimit（0=无限制）→ 个人设置 → 默认 1TB
  let limit = 1024 * 1024 * 1024 * 1024
  if (userId === TEST_USER_ID) {
    limit = TEST_USER_LIMIT
  } else {
    const group = await getUserGroup(userId)
    if (group) {
      limit = group.storageLimit
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
  }

  return {
    used: Number(row?.used ?? 0),
    limit
  }
})
