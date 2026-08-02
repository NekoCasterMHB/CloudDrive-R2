// GET /api/share/:token/download?fileId= — 公开下载分享内的文件
import { db } from '@nuxthub/db'
import { files as filesTable } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { r2Get } from '../../../utils/r2'
import { getValidShare, parseShareItems, isShareAuthorized, isFileWithinShares } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const query = getQuery(event)
  const fileId = query.fileId as string
  const isInline = query.inline === '1' || query.inline === 'true'
  if (!token || !fileId) throw createError({ statusCode: 400, message: '缺少参数' })

  const share = await getValidShare(event, token)
  if (!isShareAuthorized(event, token, !!share.password)) {
    throw createError({ statusCode: 401, message: '需要密码' })
  }

  const itemList = parseShareItems(share.items)
  const sharedFolderIds = new Set(itemList.filter(i => i.type === 'folder').map(i => i.id))
  const sharedFileIds = new Set(itemList.filter(i => i.type === 'file').map(i => i.id))

  // 文件必须属于分享范围
  if (!await isFileWithinShares(fileId, sharedFolderIds, sharedFileIds)) {
    throw createError({ statusCode: 403, message: '无权访问' })
  }

  const row = await db.select().from(filesTable).where(eq(filesTable.id, fileId)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '文件不存在' })

  const obj = await r2Get(row.objectKey)
  if (!obj) throw createError({ statusCode: 404, message: '文件内容不存在或已删除' })

  const body = await obj.arrayBuffer()
  const cd = `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(row.filename)}"`
  return new Response(body, {
    headers: {
      'Content-Type': row.contentType,
      'Content-Disposition': cd,
      'Access-Control-Allow-Origin': '*'
    }
  })
})
