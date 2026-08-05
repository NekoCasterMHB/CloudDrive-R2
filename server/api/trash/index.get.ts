// GET /api/trash — 列出回收站文件
export default defineEventHandler(async (event) => {
  const { db } = await import('@nuxthub/db')
  const { trash } = await import('../../database/schema')
  const { desc, eq } = await import('drizzle-orm')
  const { purgeExpiredTrashForUser } = await import('../../utils/trash-cleanup')
  const userId = await requireUserId(event)

  // 惰性清理：先清除该用户已过期的回收站记录（同时删除 R2 对象、释放使用量）
  await purgeExpiredTrashForUser(userId)

  const items = await db.select().from(trash)
    .where(eq(trash.userId, userId))
    .orderBy(desc(trash.deletedAt))
    .limit(100)

  return { items }
})
