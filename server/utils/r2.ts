/**
 * R2 存储工具 — 统一通过 R2 binding（env.R2）访问
 *
 * 本地开发：wrangler getPlatformProxy() 提供本地 R2（.wrangler/state/v3 持久化）
 * 部署后：Cloudflare R2 binding
 *
 * 注：
 *  - R2 binding 不支持 S3 预签名 URL，分片上传改为经 Worker 代理（见 /api/upload/part）。
 *  - R2 binding 的分片操作（uploadPart/complete/abort）挂在 createMultipartUpload
 *    返回的 R2MultipartUpload 对象上，而非 bucket 上，因此进程内缓存该对象，
 *    并在 worker 重启后通过 resumeMultipartUpload 恢复。
 */
import { getR2 } from './bindings'

// 进程内缓存 R2MultipartUpload 对象（uploadId -> multipart upload）
const multipartUploads = new Map<string, any>()

function getMultipartUpload(uploadId: string, key: string): any {
  const cached = multipartUploads.get(uploadId)
  if (cached) return cached
  // worker 重启/多实例后尝试从 R2 恢复
  const r2 = getR2()
  if (typeof r2.resumeMultipartUpload === 'function') {
    const mp = r2.resumeMultipartUpload(key, uploadId)
    multipartUploads.set(uploadId, mp)
    return mp
  }
  throw new Error(`R2 MultipartUpload 会话不可用: ${uploadId}`)
}

/** 上传文件到 R2 */
export async function r2Put(key: string, body: Buffer | Blob | string, contentType?: string) {
  const options: any = {}
  if (contentType) options.httpMetadata = { contentType }
  await getR2().put(key, body, options)
}

/** 读取文件对象（返回 R2ObjectBody | null） */
export async function r2Get(key: string) {
  return getR2().get(key)
}

/** 复制 R2 对象（binding 无服务端 copy；get 的流无已知长度，先缓冲到内存再 put） */
export async function r2Copy(srcKey: string, destKey: string, contentType?: string) {
  const r2 = getR2()
  const src = await r2.get(srcKey)
  if (!src) throw new Error(`R2 对象不存在: ${srcKey}`)
  const body = await src.arrayBuffer()
  const options: any = {}
  if (contentType) options.httpMetadata = { contentType }
  await r2.put(destKey, body, options)
}

/** 删除文件 */
export async function r2Delete(key: string) {
  await getR2().delete(key)
}

/** 创建 Multipart Upload，返回 uploadId */
export async function r2CreateMultipartUpload(key: string, contentType?: string): Promise<string> {
  const options: any = {}
  if (contentType) options.httpMetadata = { contentType }
  const mp = await getR2().createMultipartUpload(key, options)
  multipartUploads.set(mp.uploadId, mp)
  return mp.uploadId
}

/** 上传单个分片（经 Worker 代理到 R2 binding），返回 ETag */
export async function r2UploadPart(uploadId: string, key: string, partNumber: number, body: ArrayBuffer | Uint8Array | string): Promise<string> {
  const mp = getMultipartUpload(uploadId, key)
  const res = await mp.uploadPart(partNumber, body)
  return (res.etag || '').replace(/"/g, '')
}

/** 完成 Multipart Upload（parts: [{ partNumber, etag }]） */
export async function r2CompleteMultipartUpload(uploadId: string, key: string, parts: { partNumber: number, etag: string }[]) {
  const mp = getMultipartUpload(uploadId, key)
  await mp.complete(parts.map(p => ({ partNumber: p.partNumber, etag: p.etag })))
  multipartUploads.delete(uploadId)
}

/** 中止 Multipart Upload（清理 R2 临时分片） */
export async function r2AbortMultipartUpload(uploadId: string, key: string) {
  try {
    const mp = getMultipartUpload(uploadId, key)
    await mp.abort()
  } catch {
    // 会话可能已不存在，忽略
  }
  multipartUploads.delete(uploadId)
}
