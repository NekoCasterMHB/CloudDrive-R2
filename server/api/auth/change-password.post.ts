// POST /api/auth/change-password — 修改密码（需验证旧密码）
import { auth } from '../../utils/auth'
import { db } from '../../database'
import { account } from '../../db/auth-schema'
import { and, eq } from 'drizzle-orm'
import { getUserGroup } from '../../utils/group'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders(event)) })
  if (!session?.user) throw createError({ statusCode: 401, message: '未登录' })

  // 用户组禁止修改密码
  const group = await getUserGroup(session.user.id)
  if (group && !group.canChangePassword) {
    throw createError({ statusCode: 403, message: '密码由系统管理员统一管理，无法修改' })
  }

  const body = await readBody(event)
  const currentPassword: string = body?.currentPassword
  const newPassword: string = body?.newPassword
  if (!newPassword || newPassword.length < 6) {
    throw createError({ statusCode: 400, message: '新密码长度至少 6 位' })
  }
  if (!currentPassword) {
    throw createError({ statusCode: 400, message: '请输入当前密码' })
  }

  const rows = await db.select().from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, 'credential')))
    .limit(1)

  const acc = rows[0]
  if (!acc?.password) throw createError({ statusCode: 400, message: '尚未设置密码，请先在登录后设置' })

  const { verifyPassword, hashPassword } = await import('better-auth/crypto')
  const valid = await verifyPassword({ hash: acc.password, password: currentPassword })
  if (!valid) throw createError({ statusCode: 400, message: '当前密码错误' })

  const hashed = await hashPassword(newPassword)

  await db.update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(account.id, acc.id))

  return { ok: true }
})
