// DELETE /api/trash/clear — 清空回收站（永久删除所有记录与 R2 对象，不可恢复）
import { r2Delete } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const { db } = await import('@nuxthub/db')
  const { trash } = await import('../../database/schema')
  const { eq } = await import('drizzle-orm')
  const userId = await requireUserId(event)

  const items = await db.select().from(trash).where(eq(trash.userId, userId))
  let deletedCount = 0
  for (const row of items) {
    // 同时删除 R2 中的文件内容
    if (row.objectKey) {
      try {
        await r2Delete(row.objectKey)
      } catch {
        // R2 对象可能已不存在，忽略
      }
    }
    await db.delete(trash).where(eq(trash.id, row.id))
    deletedCount++
  }
  return { success: true, deletedCount }
})
