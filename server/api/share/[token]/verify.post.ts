// POST /api/share/:token/verify — 校验分享密码并授权（设置 share_ok cookie）
import { getValidShare, verifySharePassword, addShareAuth } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: '缺少参数' })

  const share = await getValidShare(event, token)
  if (!share.password) {
    // 无密码分享直接授权
    addShareAuth(event, token)
    return { ok: true }
  }

  const body = await readBody(event)
  const pwd = String(body?.password || '')
  const ok = await verifySharePassword(share.password, pwd)
  if (!ok) throw createError({ statusCode: 401, message: '密码错误' })

  addShareAuth(event, token)
  return { ok: true }
})
