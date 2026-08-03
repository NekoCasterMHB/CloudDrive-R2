// 用户组配置辅助：查询用户所属组，供设置/存储配额/改密码等统一覆盖
import { db } from '../database'
import { user } from '../db/auth-schema'
import { userGroups } from '../database/schema'
import { eq } from 'drizzle-orm'

export interface GroupConfig {
  id: string
  name: string
  storageLimit: number // 0 = 无限制
  canChangePassword: boolean
  uploadChunkSize: number // 0 = 使用个人/默认值
}

/** 根据 userId 查询所属用户组配置（无分组返回 null） */
export async function getUserGroup(userId: string): Promise<GroupConfig | null> {
  const [u] = await db.select({ groupId: user.groupId }).from(user).where(eq(user.id, userId)).limit(1)
  if (!u?.groupId) return null
  const [g] = await db.select().from(userGroups).where(eq(userGroups.id, u.groupId)).limit(1)
  if (!g) return null
  return {
    id: g.id,
    name: g.name,
    storageLimit: g.storageLimit,
    canChangePassword: !!g.canChangePassword,
    uploadChunkSize: g.uploadChunkSize
  }
}
