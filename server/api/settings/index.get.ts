// GET /api/settings — 返回当前用户的全部设置（带默认值）
import { db } from '@nuxthub/db'
import { userSettings } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { getUserGroup } from '../../utils/group'

export const DEFAULT_STORAGE_LIMIT = 1024 * 1024 * 1024 * 1024 // 1 TB

export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  uploadChunkSize: 10 * 1024 * 1024, // 10 MB
  cacheEnabled: true,
  cacheMaxSize: 1024 * 1024 * 1024, // 1 GB
  cacheTypes: ['image', 'video', 'audio'],
  storageLimit: DEFAULT_STORAGE_LIMIT
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId))

  const out: Record<string, unknown> = { ...SETTINGS_DEFAULTS }
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value)
    } catch {
      // 忽略损坏的设置值，使用默认值
    }
  }
  // 测试用户存储上限固定 100MB，不可更改
  if (userId === TEST_USER_ID) out.storageLimit = TEST_USER_LIMIT

  // 用户组覆盖：被分配用户组后，存储上限/分片大小由系统管理员统一管理
  const group = await getUserGroup(userId)
  const managed: string[] = []
  let canChangePassword = true
  if (group) {
    // storageLimit：0 表示无限制
    out.storageLimit = group.storageLimit
    // uploadChunkSize：0 表示使用个人/默认值（不强制覆盖）
    if (group.uploadChunkSize > 0) out.uploadChunkSize = group.uploadChunkSize
    canChangePassword = group.canChangePassword
    managed.push('storageLimit', 'uploadChunkSize')
    if (!group.canChangePassword) managed.push('canChangePassword')
  }

  return {
    ...out,
    managed, // 被用户组锁定的设置项 key（设置页禁用并提示由管理员统一管理）
    canChangePassword,
    groupName: group?.name ?? null
  }
})

