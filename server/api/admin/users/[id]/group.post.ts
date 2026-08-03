// POST /api/admin/users/:id/group — 设置用户所属用户组，仅管理员
import { db } from '@nuxthub/db'
import { user } from '../../../../db/auth-schema'
import { userGroups } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少用户 id' })

  const body = await readBody(event)
  const groupId: string | null = body?.groupId ?? null
  if (groupId !== null) {
    const g = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1)
    if (!g[0]) throw createError({ statusCode: 400, message: '用户组不存在' })
  }
  await db.update(user).set({ groupId, updatedAt: new Date() }).where(eq(user.id, id))
  return { ok: true }
})
