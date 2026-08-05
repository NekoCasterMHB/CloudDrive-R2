// POST /api/trash — 将文件/文件夹移入回收站
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  console.log('[trash POST] body:', JSON.stringify(body))
  const { id, type, originalPath } = body
  if (!id || !type) throw createError({ statusCode: 400, message: '缺少参数' })

  const { db } = await import('@nuxthub/db')
  const { files, folders, trash } = await import('../../database/schema')
  const { eq, inArray } = await import('drizzle-orm')
  const crypto = await import('node:crypto')

  const userId = await requireUserId(event)
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
      objectKey: row.objectKey
    }
    console.log('[trash POST] insert value:', JSON.stringify(insertVal, (k, v) => v instanceof Date ? v.toISOString() : v))
    await db.insert(trash).values(insertVal)
    console.log('[trash POST] inserted, now deleting file')
    await db.delete(files).where(eq(files.id, id))
  } else {
    const row = await db.select().from(folders).where(eq(folders.id, id)).limit(1).then(r => r[0])
    console.log('[trash POST] folder row:', JSON.stringify(row))
    if (!row) throw createError({ statusCode: 404, message: '文件夹不存在' })

    // 递归收集该文件夹下所有文件与子文件夹（含自身），一并移入回收站。
    // 关键：文件夹内文件必须带真实 size/objectKey 进入回收站，否则清空回收站时
    // 无法删除对应的 R2 对象，文件夹占用的空间将永远无法释放。
    const basePath = originalPath || row.name
    const allFolders: any[] = [row]
    const allFiles: any[] = []
    let frontier = [row.id]
    while (frontier.length > 0) {
      const subs = await db.select().from(folders).where(inArray(folders.parentId, frontier)).all()
      const fs = await db.select().from(files).where(inArray(files.folderId, frontier)).all()
      allFolders.push(...subs)
      allFiles.push(...fs)
      frontier = subs.map((f: any) => f.id)
    }

    // 文件进回收站（保留真实大小与 objectKey，清空/单删时可删除 R2 释放空间）
    for (const f of allFiles) {
      await db.insert(trash).values({
        id: crypto.randomUUID(),
        userId,
        fileId: f.id,
        folderId: f.folderId,
        name: f.filename,
        originalPath: `${basePath}/${f.filename}`,
        size: f.size,
        deletedAt: now,
        expiresAt,
        isFolder: false,
        objectKey: f.objectKey
      })
    }

    // 文件夹进回收站（外壳，size=0；内部文件已单独计入）
    for (const fo of allFolders) {
      await db.insert(trash).values({
        id: crypto.randomUUID(),
        userId,
        // fileId 对文件夹记录存「原文件夹 id」，供还原时按 folderId 精确关联其内部内容
        fileId: fo.id,
        folderId: fo.parentId,
        name: fo.name,
        originalPath: fo.id === row.id ? basePath : `${basePath}/${fo.name}`,
        size: 0,
        deletedAt: now,
        expiresAt,
        isFolder: true
      })
    }

    // 删除文件与文件夹记录（先文件后文件夹；文件夹子级优先删除）
    for (const f of allFiles) {
      await db.delete(files).where(eq(files.id, f.id))
    }
    for (const fo of [...allFolders].reverse()) {
      await db.delete(folders).where(eq(folders.id, fo.id))
    }
  }

  console.log('[trash POST] done')
  return { success: true }
})
