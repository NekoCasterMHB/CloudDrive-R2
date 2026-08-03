// POST /api/auth/sign-in/password — 用户名密码登录
// 用户名可以是邮箱地址或用户昵称（name），验证密码后创建会话
import { auth } from '../../../utils/auth'
import { db } from '../../../database'
import { user } from '../../../db/auth-schema'
import { or, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username: string = body?.username
  const password: string = body?.password
  if (!username || !password) {
    // 返回 i18n key，前端按 app. 前缀用 $t 翻译
    throw createError({ statusCode: 400, message: 'app.enterUsernameAndPassword' })
  }

  // 通过邮箱或昵称查找用户
  const users = await db.select().from(user)
    .where(or(eq(user.email, username), eq(user.name, username)))
    .limit(1)

  const u = users[0]
  if (!u) throw createError({ statusCode: 400, message: 'app.loginFailed' })

  // 复用 better-auth 完整 HTTP 处理（邮箱密码登录），自动校验密码并设置会话 cookie
  const url = new URL('/api/auth/sign-in/email', getRequestURL(event).origin)
  const request = new Request(url, {
    method: 'POST',
    headers: getRequestHeaders(event) as HeadersInit,
    body: JSON.stringify({ email: u.email, password })
  })
  const response = await auth.handler(request)

  if (!response.ok) {
    throw createError({ statusCode: 400, message: 'app.loginFailed' })
  }

  // 直接返回 better-auth 的 Response（自动携带会话 Set-Cookie，与 catch-all 路由一致）
  return response
})
