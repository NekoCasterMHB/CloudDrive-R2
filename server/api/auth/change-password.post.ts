// POST /api/auth/change-password — 修改密码（需验证旧密码）
import { auth } from '../../utils/auth'
import { db } from '../../database'
import { account } from '../../db/auth-schema'
import { and, eq } from 'drizzle-orm'
import { getUserGroup } from '../../utils/group'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders(event)) })
  if (!session?.user) throw createError({ statusCode: 401, message: 'app.notLoggedIn' })

  // 用户组禁止修改密码
  const group = await getUserGroup(session.user.id)
  if (group && !group.canChangePassword) {
    throw createError({ statusCode: 403, message: 'app.passwordManagedByAdmin' })
  }

  const body = await readBody(event)
  const currentPassword: string = body?.currentPassword
  const newPassword: string = body?.newPassword
  if (!newPassword || newPassword.length < 6) {
    throw createError({ statusCode: 400, message: 'app.passwordTooShort' })
  }
  if (!currentPassword) {
    throw createError({ statusCode: 400, message: 'app.enterCurrentPassword' })
  }

  const rows = await db.select().from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'credential')))
    .limit(1)

  const acc = rows[0]
  if (!acc?.password) throw createError({ statusCode: 400, message: 'app.noPasswordSet' })

  const { verifyPassword, hashPassword } = await import('better-auth/crypto')
  const valid = await verifyPassword({ hash: acc.password, password: currentPassword })
  if (!valid) throw createError({ statusCode: 400, message: 'app.currentPasswordWrong' })

  const hashed = await hashPassword(newPassword)

  await db.update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(account.id, acc.id))

  return { ok: true }
})
