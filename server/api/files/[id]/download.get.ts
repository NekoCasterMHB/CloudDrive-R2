// GET /api/files/:id/download — 代理 R2 文件内容（R2 binding）
//   ?download=1 → Content-Disposition: attachment（下载）
//   否则 inline（预览）
//   支持 HTTP Range（bytes=start-end）→ 206 分段响应，供视频首帧缩略图/预览拖拽定位使用
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

  // 解析 Range 头：bytes=start-end / bytes=start- / bytes=-suffix
  const rangeHeader = getRequestHeader(event, 'range')
  let start = 0
  let end: number | undefined
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
    if (m && (m[1] || m[2])) {
      const size = row.size
      if (m[1]) start = parseInt(m[1], 10)
      if (m[2]) end = parseInt(m[2], 10)
      // 后缀范围：bytes=-N 表示最后 N 字节
      if (!m[1] && m[2]) start = Math.max(size - parseInt(m[2], 10), 0)
      if (start >= size) {
        throw createError({
          statusCode: 416,
          statusMessage: 'Range Not Satisfiable',
          headers: { 'Content-Range': `bytes */${size}` }
        })
      }
      if (end === undefined || end >= size) end = size - 1
    } else {
      // 非法 Range 头 → 忽略，返回完整内容
      end = undefined
      start = 0
    }
  }

  const hasRange = rangeHeader !== undefined && end !== undefined
  const obj = await r2Get(row.objectKey, hasRange ? { offset: start, length: end! - start + 1 } : undefined)
  if (!obj) throw createError({ statusCode: 404, message: '文件内容不存在或已删除' })

  const disposition = isDownload ? 'attachment' : 'inline'
  const cd = `${disposition}; filename="${encodeURIComponent(row.filename)}"`

  if (hasRange) {
    const contentLength = end! - start + 1
    const headers = {
      'Content-Type': row.contentType,
      'Content-Disposition': cd,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${row.size}`,
      'Content-Length': String(contentLength),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
    return new Response(obj.body, { status: 206, headers })
  }

  const body = await obj.arrayBuffer()
  if (!body) throw createError({ statusCode: 500, message: '无法读取文件内容' })

  setResponseHeader(event, 'Content-Type', row.contentType)
  setResponseHeader(event, 'Content-Disposition', cd)
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
  setResponseHeader(event, 'Accept-Ranges', 'bytes')
  return new Response(body, {
    headers: {
      'Content-Type': row.contentType,
      'Content-Disposition': cd,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Accept-Ranges': 'bytes'
    }
  })
})
