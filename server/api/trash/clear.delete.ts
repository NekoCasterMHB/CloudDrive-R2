// DELETE /api/trash/clear — 清空回收站（永久删除所有记录与 R2 对象，不可恢复）
// 同时清理该用户所有未完成的上传会话，释放中断/失败上传占用的配额。
import { r2AbortMultipartUpload, r2Delete } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const { db } = await import('@nuxthub/db')
  const { files, folders, trash, uploadParts, uploadSessions } = await import('../../database/schema')
  const { and, eq, inArray } = await import('drizzle-orm')
  const userId = await requireUserId(event)

  const items = await db.select().from(trash).where(eq(trash.userId, userId))
  let deletedCount = 0
  let failedCount = 0
  for (const row of items) {
    // 同时删除 R2 中的文件内容；R2 删除失败时保留该记录（不可静默删记录，
    // 否则对象残留且记录已删，将永远无法再通过回收站清理释放空间）
    if (row.objectKey) {
      try {
        await r2Delete(row.objectKey)
      } catch {
        failedCount++
        continue
      }
    }
    await db.delete(trash).where(eq(trash.id, row.id))
    deletedCount++
  }

  // 兼容历史数据：清理指向已不存在文件夹的孤儿文件（早期版本删除文件夹未递归移入回收站，
  // 导致内部文件残留在 files 表、R2 对象永远无法释放）。清空回收站时一并释放空间。
  const folderRows = await db.select({ id: folders.id }).from(folders).where(eq(folders.userId, userId))
  const folderIds = new Set(folderRows.map(f => f.id))
  const userFiles = await db.select().from(files).where(eq(files.userId, userId))
  let orphanCount = 0
  for (const f of userFiles) {
    if (f.folderId && !folderIds.has(f.folderId)) {
      try {
        await r2Delete(f.objectKey)
      } catch {
        failedCount++
        continue
      }
      await db.delete(files).where(eq(files.id, f.id))
      orphanCount++
    }
  }

  // 一并清理该用户所有未完成的上传会话（中止 R2 分片 + 删记录 + 删分片表），
  // 释放中断/失败上传占用的配额（R2 分片存储 + 会话占用）
  const sessions = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.userId, userId), inArray(uploadSessions.status, ['pending', 'uploading']))
  )
  let sessionCount = 0
  for (const s of sessions) {
    try {
      await r2AbortMultipartUpload(s.uploadId, s.objectKey)
    } catch {
      // R2 Multipart 会话可能已失效，忽略
    }
    await db.delete(uploadParts).where(eq(uploadParts.sessionId, s.id)).run()
    await db.delete(uploadSessions).where(eq(uploadSessions.id, s.id)).run()
    sessionCount++
  }

  return { success: true, deletedCount, orphanCount, failedCount, sessionCount }
})
