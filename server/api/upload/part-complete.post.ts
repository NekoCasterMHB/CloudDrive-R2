// POST /api/upload/part-complete — 确认分片上传完成（记录 ETag）
import { db } from '@nuxthub/db'
import { uploadSessions, uploadParts } from '../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { sessionId, partNumber, etag, size } = await readBody(event)
  if (!sessionId || !partNumber) throw createError({ statusCode: 400, message: '缺少参数' })

  const userId = await requireUserId(event)
  const session = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId))
  ).limit(1).then(r => r[0])
  if (!session) throw createError({ statusCode: 404, message: '会话不存在' })

  // upsert 分片记录
  const existing = await db.select().from(uploadParts).where(
    and(eq(uploadParts.sessionId, sessionId), eq(uploadParts.partNumber, partNumber))
  ).limit(1).then(r => r[0])

  if (existing) {
    await db.update(uploadParts).set({ etag, size: size ?? 0, status: 'completed' }).where(eq(uploadParts.id, existing.id)).run()
  } else {
    await db.insert(uploadParts).values({
      id: crypto.randomUUID(),
      sessionId,
      partNumber,
      etag,
      size: size ?? 0,
      status: 'completed'
    }).run()
  }

  return { success: true }
})
