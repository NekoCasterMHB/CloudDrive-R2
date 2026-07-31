// POST /api/upload/abort — 取消上传（中止 R2 Multipart，清理会话与分片）
import { db } from '@nuxthub/db'
import { uploadSessions, uploadParts } from '../../database/schema'
import { eq, and } from 'drizzle-orm'
import { r2AbortMultipartUpload } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const { sessionId } = await readBody(event)
  if (!sessionId) throw createError({ statusCode: 400, message: '缺少参数' })

  const userId = 'mock-user-id'
  const session = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId))
  ).limit(1).then(r => r[0])
  if (!session) throw createError({ statusCode: 404, message: '会话不存在' })

  // 中止 R2 Multipart Upload（清理临时分片）
  await r2AbortMultipartUpload(session.uploadId, session.objectKey)

  // 清理会话与分片记录
  await db.delete(uploadParts).where(eq(uploadParts.sessionId, sessionId)).run()
  await db.update(uploadSessions).set({ status: 'cancelled' }).where(eq(uploadSessions.id, sessionId)).run()

  return { success: true }
})
