// POST /api/copy — 复制文件/文件夹到目标文件夹（文件夹含递归复制全部子内容，R2 对象浅复制新 key）
import { db } from '@nuxthub/db'
import { files as filesTable, folders as foldersTable } from '../database/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { r2Copy } from '../utils/r2'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { items, targetFolderId } = body
  const userId = await requireUserId(event)
  const targetId = targetFolderId || null

  if (!Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: '缺少要复制的项目' })
  }

  if (targetId) {
    const target = await db.select().from(foldersTable).where(
      and(eq(foldersTable.id, targetId), eq(foldersTable.userId, userId))
    ).limit(1).then(r => r[0])
    if (!target) throw createError({ statusCode: 404, message: '目标文件夹不存在' })
  }

  const srcFolderIds: string[] = []
  const srcFileIds: string[] = []
  for (const it of items) {
    if (it.type === 'folder') srcFolderIds.push(it.id)
    else if (it.type === 'file') srcFileIds.push(it.id)
  }
  if (srcFolderIds.length + srcFileIds.length === 0) {
    throw createError({ statusCode: 400, message: '缺少要复制的项目' })
  }

  const allFolders = await db.select().from(foldersTable).where(eq(foldersTable.userId, userId)).all()
  const allFiles = await db.select().from(filesTable).where(eq(filesTable.userId, userId)).all()

  // 收集需复制的文件夹集合（含所有子孙）
  const copyFolderIds = new Set<string>(srcFolderIds)
  let changed = true
  while (changed) {
    changed = false
    for (const f of allFolders) {
      if (f.parentId && copyFolderIds.has(f.parentId) && !copyFolderIds.has(f.id)) {
        copyFolderIds.add(f.id)
        changed = true
      }
    }
  }

  // 目标目录已有名称（用于顶层同名处理）
  const targetFolders = targetId
    ? await db.select().from(foldersTable).where(and(eq(foldersTable.userId, userId), eq(foldersTable.parentId, targetId))).all()
    : await db.select().from(foldersTable).where(and(eq(foldersTable.userId, userId), isNull(foldersTable.parentId))).all()
  const targetFiles = targetId
    ? await db.select().from(filesTable).where(and(eq(filesTable.userId, userId), eq(filesTable.folderId, targetId))).all()
    : await db.select().from(filesTable).where(and(eq(filesTable.userId, userId), isNull(filesTable.folderId))).all()
  const usedFolderNames = new Set(targetFolders.map(f => f.name))
  const usedFileNames = new Set(targetFiles.map(f => f.filename))

  function uniqueName(base: string, used: Set<string>): string {
    if (!used.has(base)) {
      used.add(base)
      return base
    }
    const dot = base.lastIndexOf('.')
    const name = dot > 0 ? base.slice(0, dot) : base
    const ext = dot > 0 ? base.slice(dot) : ''
    let i = 1
    while (used.has(`${name} (${i})${ext}`)) i++
    const n = `${name} (${i})${ext}`
    used.add(n)
    return n
  }

  const now = new Date()
  const newFolders: any[] = []
  const newFiles: any[] = []
  const folderIdMap = new Map<string, string>() // 旧id -> 新id

  // 递归复制文件夹
  function cloneFolder(oldId: string, newParentId: string | null) {
    if (folderIdMap.has(oldId)) return folderIdMap.get(oldId)!
    const old = allFolders.find(f => f.id === oldId)!
    const name = newParentId === targetId ? uniqueName(old.name, usedFolderNames) : old.name
    const newId = crypto.randomUUID()
    folderIdMap.set(oldId, newId)
    newFolders.push({ id: newId, userId, parentId: newParentId, name, createdAt: now, updatedAt: now })
    // 子文件夹（新父 = newId）
    for (const f of allFolders) {
      if (f.parentId === oldId && copyFolderIds.has(f.id)) {
        cloneFolder(f.id, newId)
      }
    }
    return newId
  }

  for (const fid of srcFolderIds) {
    cloneFolder(fid, targetId)
  }

  // 复制文件：顶层源文件 + 被复制文件夹内的文件
  const filesToCopy = allFiles.filter(f =>
    srcFileIds.includes(f.id) || (f.folderId && copyFolderIds.has(f.folderId))
  )

  for (const old of filesToCopy) {
    // 新文件夹映射：若文件在被复制文件夹内，映射到新文件夹；顶层源文件复制到目标
    let newFolderId: string | null = targetId
    if (old.folderId && copyFolderIds.has(old.folderId)) {
      newFolderId = folderIdMap.get(old.folderId) ?? targetId
    }
    const isTop = srcFileIds.includes(old.id)
    const name = isTop ? uniqueName(old.filename, usedFileNames) : old.filename
    const newId = crypto.randomUUID()
    const newObjectKey = `${userId}/${newId}/${old.filename}`
    try {
      // 通过 R2 binding 复制对象
      await r2Copy(old.objectKey, newObjectKey, old.contentType)
    } catch (e: any) {
      // R2 复制失败则不创建记录（跳过该文件）
      console.error(`[copy] r2Copy 失败 ${old.objectKey} -> ${newObjectKey}:`, e?.message || e)
      continue
    }
    newFiles.push({
      id: newId,
      userId,
      folderId: newFolderId,
      filename: name,
      objectKey: newObjectKey,
      size: old.size,
      contentType: old.contentType,
      etag: old.etag,
      thumbnailKey: old.thumbnailKey,
      createdAt: now,
      updatedAt: now
    })
  }

  // 批量写入
  if (newFolders.length) await db.insert(foldersTable).values(newFolders).run()
  if (newFiles.length) await db.insert(filesTable).values(newFiles).run()

  return { copied: items.length, folders: newFolders, files: newFiles }
})
