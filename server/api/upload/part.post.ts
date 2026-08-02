// POST /api/upload/part?sessionId=..&partNumber=.. — 上传单个分片（经 Worker 代理到 R2 binding）
// R2 binding 不支持 S3 预签名 URL，因此分片由前端 POST 到本接口，服务端通过 env.R2 上传。
import { db } from '@nuxthub/db'
import { uploadSessions } from '../../database/schema'
import { eq, and } from 'drizzle-orm'
import { r2UploadPart } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const sessionId = (query.sessionId as string) || ''
  const partNumber = Number(query.partNumber)
  if (!sessionId || !partNumber) throw createError({ statusCode: 400, message: '缺少参数' })

  const userId = await requireUserId(event)
  const session = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId))
  ).limit(1).then(r => r[0])
  if (!session) throw createError({ statusCode: 404, message: '会话不存在' })

  // 读取分片二进制内容。
  // 注意：readRawBody 默认 encoding="utf8" 会把二进制解码成字符串（二进制损坏），
  // 必须传 false 获取原始 Buffer。
  const chunk = await readRawBody(event, false)
  if (!chunk || chunk.byteLength === 0) throw createError({ statusCode: 400, message: '分片内容为空' })

  // 通过 R2 binding 上传分片，返回 ETag
  const etag = await r2UploadPart(session.uploadId, session.objectKey, partNumber, chunk)

  return { etag, partNumber, size: chunk.byteLength }
})
