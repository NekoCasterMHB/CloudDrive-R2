// GET /api/index — 一次性返回当前用户的所有文件夹与文件（用于本地索引）
import { db } from '@nuxthub/db'
import { folders as foldersTable, files as filesTable } from '../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const folderList = await db.select().from(foldersTable).where(eq(foldersTable.userId, userId)).all()
  const fileList = await db.select().from(filesTable).where(eq(filesTable.userId, userId)).all()

  return { folders: folderList, files: fileList }
})
