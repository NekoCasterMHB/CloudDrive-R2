// POST /api/trash — 将文件/文件夹移入回收站
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  console.log('[trash POST] body:', JSON.stringify(body))
  const { id, type, originalPath } = body
  if (!id || !type) throw createError({ statusCode: 400, message: '缺少参数' })

  const { db } = await import('@nuxthub/db')
  const { files, folders, trash } = await import('../../database/schema')
  const { eq } = await import('drizzle-orm')
  const crypto = await import('node:crypto')

  const userId = 'mock-user-id'
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  if (type === 'file') {
    const row = await db.select().from(files).where(eq(files.id, id)).limit(1).then(r => r[0])
    console.log('[trash POST] file row:', JSON.stringify(row))
    if (!row) throw createError({ statusCode: 404, message: '文件不存在' })

    const insertVal = {
      id: crypto.randomUUID(),
      userId,
      fileId: row.id,
      name: row.filename,
      originalPath: originalPath || row.filename,
      size: row.size,
      deletedAt: now,
      expiresAt,
      isFolder: false,
      objectKey: row.objectKey,
    }
    console.log('[trash POST] insert value:', JSON.stringify(insertVal, (k, v) => v instanceof Date ? v.toISOString() : v))
    await db.insert(trash).values(insertVal)
    console.log('[trash POST] inserted, now deleting file')
    await db.delete(files).where(eq(files.id, id))
  } else {
    const row = await db.select().from(folders).where(eq(folders.id, id)).limit(1).then(r => r[0])
    console.log('[trash POST] folder row:', JSON.stringify(row))
    if (!row) throw createError({ statusCode: 404, message: '文件夹不存在' })

    const insertVal = {
      id: crypto.randomUUID(),
      userId,
      folderId: row.parentId,
      name: row.name,
      originalPath: originalPath || row.name,
      size: 0,
      deletedAt: now,
      expiresAt,
      isFolder: true,
    }
    console.log('[trash POST] insert value:', JSON.stringify(insertVal, (k, v) => v instanceof Date ? v.toISOString() : v))
    await db.insert(trash).values(insertVal)
    console.log('[trash POST] inserted, now deleting folder')
    await db.delete(folders).where(eq(folders.id, id))
  }

  console.log('[trash POST] done')
  return { success: true }
})
