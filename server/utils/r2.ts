/**
 * R2 存储工具 — 本地 S3 API 直连 / 部署后 R2 binding
 *
 * 本地开发：通过 S3 兼容 API 直连远程 R2
 * 部署后：使用 Cloudflare R2 binding
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = 'clouddrive-files'

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.NUXT_HUB_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY || '',
    },
  })
}

/** 上传文件到 R2 */
export async function r2Put(key: string, body: Buffer | Blob | string, contentType?: string) {
  const s3 = getS3Client()
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

/** 生成文件下载签名 URL */
export async function r2GetSignedUrl(key: string, expiresIn = 900): Promise<string> {
  const s3 = getS3Client()
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn })
}

/** 删除文件 */
export async function r2Delete(key: string) {
  const s3 = getS3Client()
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }))
}

/** 创建 Multipart Upload，返回 uploadId */
export async function r2CreateMultipartUpload(key: string, contentType?: string): Promise<string> {
  const s3 = getS3Client()
  const res = await s3.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  }))
  return res.UploadId!
}

/** 生成指定分片的上传签名 URL（前端直传 R2） */
export async function r2GetUploadPartSignedUrl(uploadId: string, key: string, partNumber: number, expiresIn = 900): Promise<string> {
  const s3 = getS3Client()
  return getSignedUrl(s3, new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  }), { expiresIn })
}

/** 上传单个分片（服务端代理到 R2），返回 ETag */
export async function r2UploadPart(uploadId: string, key: string, partNumber: number, body: Buffer): Promise<string> {
  const s3 = getS3Client()
  const res = await s3.send(new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: body,
  }))
  return (res.ETag || '').replace(/"/g, '')
}

/** 完成 Multipart Upload（parts: [{ partNumber, etag }]） */
export async function r2CompleteMultipartUpload(uploadId: string, key: string, parts: { partNumber: number; etag: string }[]) {
  const s3 = getS3Client()
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
    },
  }))
}

/** 中止 Multipart Upload（清理 R2 临时分片） */
export async function r2AbortMultipartUpload(uploadId: string, key: string) {
  const s3 = getS3Client()
  await s3.send(new AbortMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
  })).catch(() => {})
}
