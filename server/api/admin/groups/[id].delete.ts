// DELETE /api/admin/groups/:id — 删除用户组（用户回到未分组），仅管理员
import { db } from '@nuxthub/db'
import { userGroups } from '../../../database/schema'
import { user } from '../../../db/auth-schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少用户组 id' })

  // 解绑该组所有用户
  await db.update(user).set({ groupId: null, updatedAt: new Date() }).where(eq(user.groupId, id))
  await db.delete(userGroups).where(eq(userGroups.id, id))
  return { ok: true }
})
