// GET /api/share/:token — 公开分享信息（无需登录）
import { getValidShare, parseShareItems } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: '缺少参数' })

  const share = await getValidShare(event, token)
  const items = parseShareItems(share.items)

  return {
    token: share.token,
    expiresAt: share.expiresAt ? new Date(share.expiresAt).getTime() : null,
    hasPassword: !!share.password,
    createdAt: new Date(share.createdAt).getTime(),
    items: items.map(i => ({ id: i.id, type: i.type, name: i.name }))
  }
})
