// POST /api/admin/users/:id/role — 授予/撤销管理员权限，仅管理员
import { db } from '@nuxthub/db'
import { user } from '../../../../db/auth-schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/user'

export default defineEventHandler(async (event) => {
  const adminId = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少用户 id' })

  const body = await readBody(event)
  const role = body?.role === 'admin' ? 'admin' : 'user'
  if (id === adminId && role !== 'admin') {
    throw createError({ statusCode: 400, message: '不能撤销自己的管理员权限' })
  }
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id))
  return { ok: true }
})
