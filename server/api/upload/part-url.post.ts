// POST /api/upload/part-url — 获取指定分片的上传签名 URL（前端直传 R2）
import { db } from '@nuxthub/db'
import { uploadSessions } from '../../database/schema'
import { eq, and } from 'drizzle-orm'
import { r2GetUploadPartSignedUrl } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const { sessionId, partNumber } = await readBody(event)
  if (!sessionId || !partNumber) throw createError({ statusCode: 400, message: '缺少参数' })

  const userId = 'mock-user-id'
  const session = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId))
  ).limit(1).then(r => r[0])
  if (!session) throw createError({ statusCode: 404, message: '会话不存在' })

  const signedUrl = await r2GetUploadPartSignedUrl(session.uploadId, session.objectKey, partNumber)
  return { signedUrl, partNumber }
})
