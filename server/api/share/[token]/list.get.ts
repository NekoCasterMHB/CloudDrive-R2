// GET /api/share/:token/list?parentId= — 公开浏览分享内容（顶层或文件夹子项）
import { db } from '@nuxthub/db'
import { files as filesTable, folders as foldersTable } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { getValidShare, parseShareItems, isShareAuthorized, isFolderWithinShares } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: '缺少参数' })
  const query = getQuery(event)
  const parentId = (query.parentId as string) || null

  const share = await getValidShare(event, token)
  if (!isShareAuthorized(event, token, !!share.password)) {
    throw createError({ statusCode: 401, message: '需要密码' })
  }

  const itemList = parseShareItems(share.items)
  const sharedFolderIds = new Set(itemList.filter(i => i.type === 'folder').map(i => i.id))

  // 顶层：返回分享的直接项目
  if (parentId === null) {
    return {
      parentId: null,
      items: itemList.map(i => ({ id: i.id, type: i.type, name: i.name }))
    }
  }

  // 文件夹子项：parentId 必须在分享文件夹树内
  if (!await isFolderWithinShares(parentId, sharedFolderIds)) {
    throw createError({ statusCode: 403, message: '无权访问' })
  }

  const folders = await db.select().from(foldersTable)
    .where(eq(foldersTable.parentId, parentId)).all()
  const files = await db.select().from(filesTable)
    .where(eq(filesTable.folderId, parentId)).all()

  return {
    parentId,
    items: [
      ...folders.map(f => ({ id: f.id, type: 'folder' as const, name: f.name })),
      ...files.map(f => ({ id: f.id, type: 'file' as const, name: f.filename, size: f.size, contentType: f.contentType }))
    ]
  }
})
