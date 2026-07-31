// POST /api/upload/complete — 完成 Multipart Upload，写入文件记录
import { db } from '@nuxthub/db'
import { uploadSessions, uploadParts, files as filesTable } from '../../database/schema'
import { eq, and } from 'drizzle-orm'
import { r2CompleteMultipartUpload } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const { sessionId } = await readBody(event)
  if (!sessionId) throw createError({ statusCode: 400, message: '缺少参数' })

  const userId = 'mock-user-id'
  const session = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId))
  ).limit(1).then(r => r[0])
  if (!session) throw createError({ statusCode: 404, message: '会话不存在' })

  // 获取所有已完成分片
  const parts = await db.select().from(uploadParts).where(
    and(eq(uploadParts.sessionId, sessionId), eq(uploadParts.status, 'completed'))
  ).orderBy(uploadParts.partNumber).all()
  if (parts.length === 0) throw createError({ statusCode: 400, message: '没有已完成的分片' })

  // 完成 R2 Multipart Upload
  await r2CompleteMultipartUpload(
    session.uploadId,
    session.objectKey,
    parts.map(p => ({ partNumber: p.partNumber, etag: p.etag || '' })),
  )

  // 写入文件记录
  const fileId = crypto.randomUUID()
  const now = new Date()
  await db.insert(filesTable).values({
    id: fileId,
    userId,
    folderId: session.folderId ?? null,
    filename: session.filename,
    objectKey: session.objectKey,
    size: session.fileSize,
    contentType: session.contentType,
    etag: parts[0].etag || '',
    createdAt: now,
    updatedAt: now,
  }).run()

  // 更新会话状态
  await db.update(uploadSessions).set({ status: 'completed' }).where(eq(uploadSessions.id, sessionId)).run()

  return {
    id: fileId,
    filename: session.filename,
    size: session.fileSize,
    folderId: session.folderId ?? null,
    contentType: session.contentType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'done',
  }
})
