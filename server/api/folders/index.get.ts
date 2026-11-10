import { db } from '@nuxthub/db'
import { folders as foldersTable, files as filesTable } from '../../database/schema'
import { eq, isNull, or, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parentId = (query.parentId as string) || null

  const userId = await requireUserId(event)

  // 历史数据里根目录的 folderId 存在 NULL 与 '' 两种表示（UI 上传路径会写入空串），
  // 查询需同时兼容，否则 UI 上传的文件会被当成不属于任何路径而漏掉
  const isRootFolder = or(isNull(foldersTable.parentId), eq(foldersTable.parentId, ''))
  const isRootFile = or(isNull(filesTable.folderId), eq(filesTable.folderId, ''))

  const folderList = await db.select().from(foldersTable).where(
    parentId
      ? and(eq(foldersTable.userId, userId), eq(foldersTable.parentId, parentId))
      : and(eq(foldersTable.userId, userId), isRootFolder)
  ).all()

  const fileList = await db.select().from(filesTable).where(
    parentId
      ? and(eq(filesTable.userId, userId), eq(filesTable.folderId, parentId))
      : and(eq(filesTable.userId, userId), isRootFile)
  ).all()

  return { folders: folderList, files: fileList, parentId }
})
