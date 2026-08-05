// 回收站过期清理：超过 expiresAt（30 天）的 trash 记录，删除 R2 对象并移除 D1 记录，释放使用量。
// 惰性清理（用户访问回收站时）兜底 + cron 定时全量清理（部署后每天自动执行）。
import { db } from '../database'
import { trash } from '../database/schema'
import { and, eq, lt } from 'drizzle-orm'
import { r2Delete } from './r2'

/** 清理单个用户已过期的回收站记录，返回删除条数 */
export async function purgeExpiredTrashForUser(userId: string): Promise<number> {
  const now = new Date()
  const items = await db.select().from(trash)
    .where(and(eq(trash.userId, userId), lt(trash.expiresAt, now)))
  let removed = 0
  for (const row of items) {
    if (row.objectKey) {
      try {
        await r2Delete(row.objectKey)
      } catch {
        // R2 对象可能已不存在，忽略
      }
    }
    await db.delete(trash).where(eq(trash.id, row.id))
    removed++
  }
  return removed
}

/** 清理全部用户已过期的回收站记录（cron 定时调用），返回删除条数 */
export async function purgeExpiredTrash(): Promise<number> {
  const now = new Date()
  const items = await db.select().from(trash).where(lt(trash.expiresAt, now))
  let removed = 0
  for (const row of items) {
    if (row.objectKey) {
      try {
        await r2Delete(row.objectKey)
      } catch {
        // R2 对象可能已不存在，忽略
      }
    }
    await db.delete(trash).where(eq(trash.id, row.id))
    removed++
  }
  return removed
}
