// POST /api/auth/set-password — 设置初始密码（验证码登录后首次设置，已设置过则拒绝）
import { auth } from '../../utils/auth'
import { db } from '../../database'
import { account } from '../../db/auth-schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders(event)) })
  if (!session?.user) throw createError({ statusCode: 401, message: 'app.notLoggedIn' })

  const body = await readBody(event)
  const password: string = body?.password
  if (!password || password.length < 6) {
    throw createError({ statusCode: 400, message: 'app.passwordTooShort' })
  }

  const rows = await db.select().from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'credential')))
    .limit(1)

  const acc = rows[0]
  if (acc?.password) throw createError({ statusCode: 400, message: 'app.passwordAlreadySet' })

  const { hashPassword } = await import('better-auth/crypto')
  const hashed = await hashPassword(password)

  if (acc) {
    await db.update(account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(account.id, acc.id))
  } else {
    // 无 credential account 记录（早期创建的账号），创建一条并写入密码
    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      accountId: session.user.id,
      providerId: 'credential',
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  return { ok: true }
})
