// GET /api/admin/groups — 用户组列表，仅管理员
import { db } from '@nuxthub/db'
import { userGroups } from '../../database/schema'
import { user } from '../../db/auth-schema'
import { requireAdmin } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const groups = await db.select().from(userGroups).all()
  const users = await db.select({ id: user.id, groupId: user.groupId }).from(user).all()
  return {
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      storageLimit: g.storageLimit,
      canChangePassword: !!g.canChangePassword,
      uploadChunkSize: g.uploadChunkSize,
      userCount: users.filter(u => u.groupId === g.id).length
    }))
  }
})
