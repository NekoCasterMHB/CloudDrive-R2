// POST /api/trash/:id/restore — 从回收站还原文件/文件夹
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const { db } = await import('@nuxthub/db')
  const { files, folders, trash } = await import('../../../database/schema')
  const { eq } = await import('drizzle-orm')
  const crypto = await import('node:crypto')

  const row = await db.select().from(trash).where(eq(trash.id, id)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '回收站记录不存在' })

  // 还原到原位置（如果原文件夹已删除则放到根目录）
  const parentId = row.folderId

  if (row.isFolder) {
    await db.insert(folders).values({
      id: crypto.randomUUID(),
      userId: row.userId,
      parentId,
      name: row.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  } else {
    await db.insert(files).values({
      id: crypto.randomUUID(),
      userId: row.userId,
      folderId: parentId,
      filename: row.name,
      objectKey: row.objectKey!,
      size: row.size,
      contentType: 'application/octet-stream',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  await db.delete(trash).where(eq(trash.id, id))
  return { success: true }
})
