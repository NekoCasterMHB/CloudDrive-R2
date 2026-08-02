// GET /api/auth/has-password — 当前登录用户是否已设置密码
import { auth } from '../../utils/auth'
import { db } from '../../database'
import { account } from '../../db/auth-schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders(event)) })
  if (!session?.user) throw createError({ statusCode: 401, message: '未登录' })

  const rows = await db.select().from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'credential')))
    .limit(1)

  return { hasPassword: !!(rows[0]?.password) }
})
