/**
 * 上传 API — 小文件直传 / 大文件分片
 *
 * POST /api/upload — 上传文件到 R2
 *  - header: x-chunk-index (可选，分片编号，0-based)
 *  - header: x-chunk-total (可选，总分片数)
 *  - header: x-upload-id (可选，分片上传会话 ID)
 *  - body: multipart/form-data (file + folderId)
 */
import { db } from '@nuxthub/db'
import { files as filesTable } from '../database/schema'

// 存储进行中的分片上传会话
const uploadSessions = new Map<string, { key: string; filename: string; contentType: string; chunks: Map<number, string>; totalChunks: number }>()

export default defineEventHandler(async (event) => {
  const form = await readFormData(event)
  const file = form.get('file') as File
  const folderId = (form.get('folderId') as string) || null

  if (!file) throw createError({ statusCode: 400, message: 'Missing file' })

  // TODO: real userId from session
  const userId = 'mock-user-id'

  const chunkIndex = parseInt(event.headers.get('x-chunk-index') ?? '0')
  const chunkTotal = parseInt(event.headers.get('x-chunk-total') ?? '1')
  const uploadId = event.headers.get('x-upload-id')

  // 生成唯一的 object key
  const fileId = crypto.randomUUID()
  const objectKey = `${userId}/${fileId}/${file.name}`

  if (chunkTotal <= 1) {
    // === 小文件：直接上传 ===
    const buffer = Buffer.from(await file.arrayBuffer())
    await r2Put(objectKey, buffer, file.type)

    await db.insert(filesTable).values({
      id: fileId,
      userId,
      folderId,
      filename: file.name,
      objectKey,
      size: file.size,
      contentType: file.type,
      etag: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run()

    return { fileId, filename: file.name, size: file.size, status: 'done' }
  }

  // === 大文件：分片上传 ===
  let session: typeof uploadSessions extends Map<any, infer V> ? V : never

  if (!uploadId || !uploadSessions.has(uploadId)) {
    // 新会话
    const id = crypto.randomUUID()
    session = {
      key: objectKey,
      filename: file.name,
      contentType: file.type,
      chunks: new Map(),
      totalChunks: chunkTotal,
    }
    uploadSessions.set(id, session)

    if (chunkIndex === 0) {
      // 首次分片，返回 uploadId
      const buffer = Buffer.from(await file.arrayBuffer())
      const chunkKey = `${objectKey}.part${chunkIndex}`
      await r2Put(chunkKey, buffer, file.type)
      session.chunks.set(chunkIndex, chunkKey)

      return { uploadId: id, chunkIndex, status: 'chunked' }
    }

    return { uploadId: id, status: 'ready' }
  }

  // 已有会话，添加分片
  session = uploadSessions.get(uploadId)!
  const buffer = Buffer.from(await file.arrayBuffer())
  const chunkKey = `${objectKey}.part${chunkIndex}`
  await r2Put(chunkKey, buffer, file.type)
  session.chunks.set(chunkIndex, chunkKey)

  // 检查是否所有分片都已上传
  if (session.chunks.size >= session.totalChunks) {
    // 合并分片 — 下载各分片后拼接
    const { S3Client, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.NUXT_HUB_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY || '',
      },
    })
    const chunks: Buffer[] = []
    for (let i = 0; i < session.totalChunks; i++) {
      const partKey = session.chunks.get(i)!
      const partRes = await s3.send(new GetObjectCommand({ Bucket: 'clouddrive-files', Key: partKey }))
      if (partRes.Body) {
        chunks.push(Buffer.from(await partRes.Body.transformToByteArray()))
      }
    }

    const merged = Buffer.concat(chunks)
    await r2Put(objectKey, merged, session.contentType)

    // 清理分片
    for (const key of session.chunks.values()) {
      await s3.send(new DeleteObjectCommand({ Bucket: 'clouddrive-files', Key: key })).catch(() => {})
    }
    uploadSessions.delete(uploadId!)

    // 持久化到数据库
    await db.insert(filesTable).values({
      id: fileId,
      userId,
      folderId,
      filename: file.name,
      objectKey,
      size: file.size,
      contentType: file.type,
      etag: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run()

    return { fileId, filename: file.name, size: file.size, status: 'done' }
  }

  return { uploadId, chunkIndex, remaining: session.totalChunks - session.chunks.size, status: 'chunked' }
})
