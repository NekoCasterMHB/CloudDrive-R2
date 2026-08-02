// GET /api/upload/session/:id — 查询断点续传状态（返回已完成分片）
import { db } from '@nuxthub/db'
import { uploadSessions, uploadParts } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  const userId = await requireUserId(event)

  const session = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId))
  ).limit(1).then(r => r[0])
  if (!session) throw createError({ statusCode: 404, message: '会话不存在' })

  const completedParts = await db.select().from(uploadParts).where(
    and(eq(uploadParts.sessionId, sessionId), eq(uploadParts.status, 'completed'))
  ).orderBy(uploadParts.partNumber).all()

  return { session, completedParts }
})
