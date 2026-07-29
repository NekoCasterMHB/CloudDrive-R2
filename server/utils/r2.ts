/**
 * R2 存储工具 — 本地 S3 API 直连 / 部署后 R2 binding
 *
 * 本地开发：通过 S3 兼容 API 直连远程 R2
 * 部署后：使用 Cloudflare R2 binding
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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
