// POST /api/upload/init — 初始化分片上传（R2 Multipart Upload）
import { db } from '@nuxthub/db'
import { uploadSessions } from '../../database/schema'
import { r2CreateMultipartUpload } from '../../utils/r2'

/** 按文件大小选择分片大小（文档策略） */
function calcPartSize(fileSize: number): number {
  if (fileSize < 100 * 1024 * 1024) return 10 * 1024 * 1024 // <100MB: 10MB
  if (fileSize < 1024 * 1024 * 1024) return 20 * 1024 * 1024 // 100MB~1GB: 20MB
  if (fileSize < 10 * 1024 * 1024 * 1024) return 50 * 1024 * 1024 // 1GB~10GB: 50MB
  return 100 * 1024 * 1024 // >10GB: 100MB
}

export default defineEventHandler(async (event) => {
  const { filename, size, contentType, folderId } = await readBody(event)
  if (!filename || !size) throw createError({ statusCode: 400, message: '缺少参数' })

  // TODO: real userId from session
  const userId = 'mock-user-id'

  // 构建 R2 对象路径: {userId}/{uuid}/{filename}
  const fileId = crypto.randomUUID()
  const objectKey = `${userId}/${fileId}/${filename}`

  // 创建 R2 Multipart Upload
  const uploadId = await r2CreateMultipartUpload(objectKey, contentType || 'application/octet-stream')

  // 存入 D1
  const sessionId = crypto.randomUUID()
  await db.insert(uploadSessions).values({
    id: sessionId,
    userId,
    folderId: folderId ?? null,
    uploadId,
    objectKey,
    filename,
    fileSize: size,
    contentType: contentType || 'application/octet-stream',
    status: 'pending',
    createdAt: new Date(),
  }).run()

  return {
    sessionId,
    uploadId,
    objectKey,
    partSize: calcPartSize(size),
    filename,
    size,
    folderId: folderId ?? null,
  }
})
