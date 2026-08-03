// GET /api/admin/users — 用户列表（含角色/用户组），仅管理员
import { db } from '@nuxthub/db'
import { user } from '../../db/auth-schema'
import { userGroups } from '../../database/schema'
import { requireAdmin } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const users = await db.select().from(user).all()
  const groups = await db.select().from(userGroups).all()
  return {
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ?? 'user',
      groupId: u.groupId ?? null,
      createdAt: new Date(u.createdAt).getTime()
    })),
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
