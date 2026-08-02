// GET /api/settings — 返回当前用户的全部设置（带默认值）
import { db } from '@nuxthub/db'
import { userSettings } from '../../database/schema'
import { eq } from 'drizzle-orm'

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
  return out
})
