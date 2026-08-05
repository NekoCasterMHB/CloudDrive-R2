// POST /api/upload/simple — 小文件直传（不走 Multipart，一次请求完成）
// 避免小文件也走 init → 传分片 → part-complete → complete 合并的多轮往返开销
import { r2Put } from '../../utils/r2'
import { getStorageQuota } from '../../utils/quota'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  // 解析 multipart form-data：file + folderId
  const form = await readMultipartFormData(event)
  const filePart = form?.find(p => p.name === 'file')
  if (!filePart?.filename || !filePart.data?.length) {
    throw createError({ statusCode: 400, message: '缺少文件' })
  }
  const folderIdRaw = form?.find(p => p.name === 'folderId')?.data
  const folderId = folderIdRaw ? Buffer.from(folderIdRaw).toString('utf8') : null
  const filename = filePart.filename
  const size = filePart.data.length
  const contentType = filePart.type || 'application/octet-stream'

  // 存储配额拦截（与 Multipart init 一致：含回收站未清除部分 + 进行中会话）
  const { used, limit } = await getStorageQuota(userId)
  if (limit > 0 && used + size > limit) {
    throw createError({ statusCode: 413, statusMessage: 'Payload Too Large', message: '存储空间不足' })
  }

  const { db } = await import('@nuxthub/db')
  const { files } = await import('../../database/schema')
  const { eq } = await import('drizzle-orm')

  // 构建 R2 对象路径: {userId}/{uuid}/{filename}
  const fileId = crypto.randomUUID()
  const objectKey = `${userId}/${fileId}/${filename}`
  await r2Put(objectKey, filePart.data, contentType)

  const now = new Date()
  await db.insert(files).values({
    id: fileId,
    userId,
    folderId,
    filename,
    objectKey,
    size,
    contentType,
    etag: '',
    createdAt: now,
    updatedAt: now
  }).run()

  return {
    id: fileId,
    filename,
    size,
    folderId,
    contentType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'done'
  }
})
