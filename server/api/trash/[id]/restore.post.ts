// POST /api/trash/:id/restore — 从回收站还原文件/文件夹
// 还原文件夹时整体递归还原其内部仍在回收站的文件与子文件夹（按原层级），
// 避免回收站残留「幽灵文件夹」（仅由子项 originalPath 合成的空壳，无操作按钮）。
// 支持 body { targetFolderId }：指定还原目标（null 表示根目录）。
// 未指定且原位置（原父文件夹）已不存在时，返回 { needsTarget: true }，由前端弹选择器让用户选还原位置。
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({})) as any
  const hasTarget = 'targetFolderId' in (body || {})
  const targetFolderId = body?.targetFolderId ?? null

  const { db } = await import('@nuxthub/db')
  const { files, folders, trash } = await import('../../../database/schema')
  const { and, eq, sql } = await import('drizzle-orm')
  const crypto = await import('node:crypto')

  const row = await db.select().from(trash).where(eq(trash.id, id)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '回收站记录不存在' })

  // 还原目标：优先用户指定；否则用原位置（原父文件夹）
  let parentId = hasTarget ? targetFolderId : row.folderId

  // 校验目标文件夹存在性
  if (parentId) {
    const parent = await db.select({ id: folders.id }).from(folders).where(eq(folders.id, parentId)).limit(1)
    if (parent.length === 0) {
      if (hasTarget) {
        // 用户指定的目标已被删除（并发操作）→ 报错让前端重新选择
        throw createError({ statusCode: 400, message: '目标文件夹不存在' })
      }
      // 原路径已不存在 → 让前端弹选择器选择还原位置
      return { needsTarget: true, name: row.name, isFolder: row.isFolder }
    }
  }

  // 单文件还原
  if (!row.isFolder) {
    const newId = crypto.randomUUID()
    await db.insert(files).values({
      id: newId,
      userId: row.userId,
      folderId: parentId,
      filename: row.name,
      objectKey: row.objectKey!,
      size: row.size,
      contentType: 'application/octet-stream',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    await db.delete(trash).where(eq(trash.id, id))
    return { id: newId, filename: row.name, folderId: parentId, size: row.size, updatedAt: Date.now(), type: 'file' }
  }

  // 文件夹：整体还原其内部仍在回收站的内容（递归）。
  // 优先按 folderId 关联（文件夹记录的 fileId 存了原文件夹 id，可靠）；历史数据无 fileId 时回退 originalPath 前缀匹配。
  // 先收集后校验统一执行 + 失败补偿，避免中途失败残留「空文件夹外壳」且回收站记录未删。
  const processed = new Set<string>()
  const folderPlan: { row: any, newId: string, parentNewId: string | null }[] = []
  const filePlan: { row: any, folderNewId: string }[] = []
  const trashIdsToDelete: string[] = []
  const oldToNew = new Map<string, string>()

  async function collectFolder(folderRow: any, newParentId: string | null): Promise<string> {
    const existing = oldToNew.get(folderRow.id)
    if (existing) return existing
    processed.add(folderRow.id)
    trashIdsToDelete.push(folderRow.id)
    const newId = crypto.randomUUID()
    oldToNew.set(folderRow.id, newId)
    folderPlan.push({ row: folderRow, newId, parentNewId: newParentId })

    let children: any[]
    if (folderRow.fileId) {
      // 直接子项：folderId = 原文件夹 id（fileId）
      children = await db.select().from(trash).where(
        and(eq(trash.userId, folderRow.userId), eq(trash.folderId, folderRow.fileId))
      )
    } else {
      // 历史数据（无 fileId）回退：originalPath 前缀精确匹配（substr 避免 LIKE 通配符歧义）
      const prefix = (folderRow.originalPath || folderRow.name) + '/'
      children = await db.select().from(trash).where(
        and(eq(trash.userId, folderRow.userId), sql`substr(${trash.originalPath}, 1, ${prefix.length}) = ${prefix}`)
      )
    }
    console.log('[restore] folder:', folderRow.name, 'fileId:', folderRow.fileId, 'children:', children.length)

    for (const c of children) {
      if (processed.has(c.id)) continue
      if (c.isFolder) {
        await collectFolder(c, newId)
      } else {
        processed.add(c.id)
        trashIdsToDelete.push(c.id)
        filePlan.push({ row: c, folderNewId: newId })
      }
    }
    return newId
  }

  const newRootId = await collectFolder(row, parentId)

  // 前置校验：所有文件必须有 objectKey，否则整体失败（避免中途报错残留空外壳）
  for (const p of filePlan) {
    if (!p.row.objectKey) {
      throw createError({ statusCode: 500, message: `回收站记录缺少对象Key: ${p.row.name}` })
    }
  }

  // 统一执行（先建文件夹层级，再插文件，最后删回收站记录）
  const createdFolderIds: string[] = []
  const createdFileIds: string[] = []
  try {
    for (const p of folderPlan) {
      await db.insert(folders).values({
        id: p.newId,
        userId: p.row.userId,
        parentId: p.parentNewId,
        name: p.row.name,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      createdFolderIds.push(p.newId)
    }
    for (const p of filePlan) {
      const fid = crypto.randomUUID()
      await db.insert(files).values({
        id: fid,
        userId: p.row.userId,
        folderId: p.folderNewId,
        filename: p.row.name,
        objectKey: p.row.objectKey,
        size: p.row.size,
        contentType: 'application/octet-stream',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      createdFileIds.push(fid)
    }
    for (const tid of trashIdsToDelete) {
      await db.delete(trash).where(eq(trash.id, tid))
    }
  } catch (e) {
    // 失败补偿：清理本次已创建的文件夹与文件，保留回收站记录以便重试
    for (const id of createdFolderIds) await db.delete(folders).where(eq(folders.id, id)).catch(() => {})
    for (const id of createdFileIds) await db.delete(files).where(eq(files.id, id)).catch(() => {})
    throw e
  }

  return { id: newRootId, name: row.name, parentId, updatedAt: Date.now(), isFolder: true, type: 'folder' }
})
