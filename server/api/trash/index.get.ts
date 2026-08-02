// GET /api/trash — 列出回收站文件
export default defineEventHandler(async (event) => {
  const { db } = await import('@nuxthub/db')
  const { trash } = await import('../../database/schema')
  const { desc, eq } = await import('drizzle-orm')
  const userId = await requireUserId(event)

  const items = await db.select().from(trash)
    .where(eq(trash.userId, userId))
    .orderBy(desc(trash.deletedAt))
    .limit(100)

  return { items }
})
