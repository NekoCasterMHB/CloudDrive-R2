// DELETE /api/trash/:id — 永久删除回收站记录
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const { db } = await import('@nuxthub/db')
  const { trash } = await import('../../../database/schema')
  const { eq } = await import('drizzle-orm')

  const row = await db.select().from(trash).where(eq(trash.id, id)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '回收站记录不存在' })

  // 如果有 objectKey，也从 R2 删除文件内容
  if (row.objectKey) {
    try { await r2Delete(row.objectKey) } catch {}
  }

  await db.delete(trash).where(eq(trash.id, id))
  return { success: true }
})
