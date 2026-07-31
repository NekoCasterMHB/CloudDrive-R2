// GET /api/files/:id/download — 代理 R2 文件内容
//   ?download=1 → Content-Disposition: attachment（下载）
//   否则 inline（预览）
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const isDownload = query.download === '1' || query.download === 'true'

  const { db } = await import('@nuxthub/db')
  const { files } = await import('../../../database/schema')
  const { eq } = await import('drizzle-orm')

  const row = await db.select().from(files).where(eq(files.id, id)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '文件不存在' })

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.NUXT_HUB_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY || '',
    },
  })

  const cmd = new GetObjectCommand({ Bucket: 'clouddrive-files', Key: row.objectKey })
  const obj = await s3.send(cmd)

  const body = await obj.Body?.transformToByteArray()
  if (!body) throw createError({ statusCode: 500, message: '无法读取文件内容' })

  const disposition = isDownload ? 'attachment' : 'inline'
  const cd = `${disposition}; filename="${encodeURIComponent(row.filename)}"`
  setResponseHeader(event, 'Content-Type', row.contentType)
  setResponseHeader(event, 'Content-Disposition', cd)
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
  return new Response(body, {
    headers: {
      'Content-Type': row.contentType,
      'Content-Disposition': cd,
      'Access-Control-Allow-Origin': '*',
    },
  })
})
