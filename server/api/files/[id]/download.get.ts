// GET /api/files/:id/download — 代理 R2 文件内容（R2 binding）
//   ?download=1 → Content-Disposition: attachment（下载）
//   否则 inline（预览）
import { r2Get } from '../../../utils/r2'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const isDownload = query.download === '1' || query.download === 'true'

  const { db } = await import('@nuxthub/db')
  const { files } = await import('../../../database/schema')
  const { eq } = await import('drizzle-orm')

  const row = await db.select().from(files).where(eq(files.id, id)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '文件不存在' })

  // 通过 R2 binding 读取对象内容
  const obj = await r2Get(row.objectKey)
  if (!obj) throw createError({ statusCode: 404, message: '文件内容不存在或已删除' })

  const body = await obj.arrayBuffer()
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
      'Access-Control-Allow-Origin': '*'
    }
  })
})
