// POST /api/move — 批量移动文件/文件夹到目标文件夹（目标为 null 表示根目录）
import { db } from '@nuxthub/db'
import { files as filesTable, folders as foldersTable } from '../database/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { items, targetFolderId } = body
  const userId = 'mock-user-id'
  const targetId = targetFolderId || null

  if (!Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: '缺少要移动的项目' })
  }

  // 校验目标文件夹存在（根目录无需）
  if (targetId) {
    const target = await db.select().from(foldersTable).where(
      and(eq(foldersTable.id, targetId), eq(foldersTable.userId, userId))
    ).limit(1).then(r => r[0])
    if (!target) throw createError({ statusCode: 404, message: '目标文件夹不存在' })
  }

  const fileIds: string[] = []
  const folderIds: string[] = []
  for (const it of items) {
    if (it.type === 'file' && it.id) fileIds.push(it.id)
    else if (it.type === 'folder' && it.id) folderIds.push(it.id)
  }
  if (fileIds.length + folderIds.length === 0) {
    throw createError({ statusCode: 400, message: '缺少要移动的项目' })
  }

  const filesToMove = fileIds.length ? await db.select().from(filesTable).where(inArray(filesTable.id, fileIds)).all() : []
  const foldersToMove = folderIds.length ? await db.select().from(foldersTable).where(inArray(foldersTable.id, folderIds)).all() : []
  if (filesToMove.length !== fileIds.length || foldersToMove.length !== folderIds.length) {
    throw createError({ statusCode: 404, message: '部分项目不存在' })
  }

  // 文件夹循环移动防护：目标不能是被移动文件夹自身或其子孙
  const movedFolderIds = new Set(foldersToMove.map(f => f.id))
  if (targetId && movedFolderIds.size > 0) {
    const allFolders = await db.select().from(foldersTable).where(eq(foldersTable.userId, userId)).all()
    let cur: string | null = targetId
    const visited = new Set<string>()
    while (cur) {
      if (movedFolderIds.has(cur)) {
        throw createError({ statusCode: 400, message: '不能移动到自身或其子文件夹中' })
      }
      if (visited.has(cur)) break
      visited.add(cur)
      cur = allFolders.find(f => f.id === cur)?.parentId ?? null
    }
  }

  // 查重：目标目录已有同名文件/文件夹
  const targetFiles = targetId
    ? await db.select().from(filesTable).where(and(eq(filesTable.userId, userId), eq(filesTable.folderId, targetId))).all()
    : await db.select().from(filesTable).where(and(eq(filesTable.userId, userId), isNull(filesTable.folderId))).all()
  const targetFolders = targetId
    ? await db.select().from(foldersTable).where(and(eq(foldersTable.userId, userId), eq(foldersTable.parentId, targetId))).all()
    : await db.select().from(foldersTable).where(and(eq(foldersTable.userId, userId), isNull(foldersTable.parentId))).all()
  const targetFileNames = new Set(targetFiles.map(f => f.filename))
  const targetFolderNames = new Set(targetFolders.map(f => f.name))

  for (const f of filesToMove) {
    if (targetFileNames.has(f.filename)) {
      throw createError({ statusCode: 409, message: `目标位置已存在同名文件：${f.filename}` })
    }
  }
  for (const fo of foldersToMove) {
    if (targetFolderNames.has(fo.name)) {
      throw createError({ statusCode: 409, message: `目标位置已存在同名文件夹：${fo.name}` })
    }
  }

  const now = new Date()
  if (fileIds.length) {
    await db.update(filesTable).set({ folderId: targetId, updatedAt: now }).where(inArray(filesTable.id, fileIds)).run()
  }
  if (folderIds.length) {
    await db.update(foldersTable).set({ parentId: targetId, updatedAt: now }).where(inArray(foldersTable.id, folderIds)).run()
  }

  // 返回更新后的记录，供前端同步本地索引
  const updatedFiles = fileIds.length ? await db.select().from(filesTable).where(inArray(filesTable.id, fileIds)).all() : []
  const updatedFolders = folderIds.length ? await db.select().from(foldersTable).where(inArray(foldersTable.id, folderIds)).all() : []

  return { moved: items.length, files: updatedFiles, folders: updatedFolders }
})
