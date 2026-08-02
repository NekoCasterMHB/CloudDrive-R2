import { db } from '@nuxthub/db'
import { folders as foldersTable, files as filesTable } from '../../database/schema'
import { eq, isNull, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parentId = (query.parentId as string) || null

  // TODO: 从 session 获取真实 userId
  const userId = await requireUserId(event)

  const folderList = await db.select().from(foldersTable).where(
    parentId
      ? and(eq(foldersTable.userId, userId), eq(foldersTable.parentId, parentId))
      : and(eq(foldersTable.userId, userId), isNull(foldersTable.parentId))
  ).all()

  const fileList = await db.select().from(filesTable).where(
    parentId
      ? and(eq(filesTable.userId, userId), eq(filesTable.folderId, parentId))
      : and(eq(filesTable.userId, userId), isNull(filesTable.folderId))
  ).all()

  return { folders: folderList, files: fileList, parentId }
})
