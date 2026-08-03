// GET /api/share/:token/all — 分享完整索引（全部文件夹 + 文件），层级变化由前端本地运算
import { db } from '@nuxthub/db'
import { files as filesTable, folders as foldersTable } from '../../../database/schema'
import { inArray } from 'drizzle-orm'
import { getValidShare, parseShareItems, isShareAuthorized } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: '缺少参数' })
  const share = await getValidShare(event, token)
  if (!isShareAuthorized(event, token, !!share.password)) {
    throw createError({ statusCode: 401, message: '需要密码' })
  }

  const itemList = parseShareItems(share.items)
  const sharedFolderIds = itemList.filter(i => i.type === 'folder').map(i => i.id)
  const sharedFileIds = itemList.filter(i => i.type === 'file').map(i => i.id)

  // BFS 收集分享文件夹树内所有文件夹 id（含直接分享的文件夹本身，
  // 否则其直接子文件会被 subFiles 查询漏掉，导致文件夹显示为空）
  const allFolderIds = new Set(sharedFolderIds)
  let frontier = sharedFolderIds
  while (frontier.length) {
    const childFolders = await db.select({ id: foldersTable.id }).from(foldersTable)
      .where(inArray(foldersTable.parentId, frontier)).all()
    const ids = childFolders.map(f => f.id)
    if (!ids.length) break
    for (const id of ids) allFolderIds.add(id)
    frontier = ids
  }
  const subFolderIds = Array.from(allFolderIds)

  // 文件夹：直接分享的顶层文件夹（parentId 归 null = 分享根）+ 树内子文件夹（保留真实 parentId）
  const topFolderSet = new Set(sharedFolderIds)
  const subFolders = subFolderIds.length
    ? await db.select({ id: foldersTable.id, parentId: foldersTable.parentId, name: foldersTable.name }).from(foldersTable)
        .where(inArray(foldersTable.id, subFolderIds)).all()
    : []
  const folders = [
    ...itemList.filter(i => i.type === 'folder').map(i => ({ id: i.id, parentId: null, name: i.name })),
    ...subFolders.filter(f => !topFolderSet.has(f.id)).map(f => ({ id: f.id, parentId: f.parentId, name: f.name }))
  ]

  // 文件：直接分享的顶层文件（folderId 归 null）+ 树内文件；按 id 去重
  const topFiles = sharedFileIds.length
    ? await db.select({ id: filesTable.id, filename: filesTable.filename, size: filesTable.size, contentType: filesTable.contentType }).from(filesTable)
        .where(inArray(filesTable.id, sharedFileIds)).all()
    : []
  const subFiles = subFolderIds.length
    ? await db.select({ id: filesTable.id, folderId: filesTable.folderId, filename: filesTable.filename, size: filesTable.size, contentType: filesTable.contentType }).from(filesTable)
        .where(inArray(filesTable.folderId, subFolderIds)).all()
    : []
  // 文件：直接分享的顶层文件（folderId 归 null）+ 树内文件。
  // 同一文件既被直接分享又在分享文件夹内时，两处都保留（根级 + 文件夹），不做去重，
  // 否则文件夹里的该文件会被吞掉导致文件夹显示为空。
  const files = [
    ...topFiles.map(f => ({ id: f.id, folderId: null, name: f.filename, size: f.size, contentType: f.contentType })),
    ...subFiles.map(f => ({ id: f.id, folderId: f.folderId, name: f.filename, size: f.size, contentType: f.contentType }))
  ]

  return { folders, files }
})
