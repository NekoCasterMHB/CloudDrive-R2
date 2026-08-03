// PUT /api/settings — 更新部分用户设置（仅保存传入的 key，upsert 到 D1）
import { db } from '@nuxthub/db'
import { userSettings } from '../../database/schema'
import { and, eq } from 'drizzle-orm'
import { SETTINGS_DEFAULTS } from './index.get'
import { getUserGroup } from '../../utils/group'

const ALLOWED_KEYS = Object.keys(SETTINGS_DEFAULTS)
// 被用户组锁定的设置项：用户无法手动修改
const GROUP_MANAGED_KEYS = ['storageLimit', 'uploadChunkSize']

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '无效的设置数据' })
  }

  // TODO: real userId from session
  const userId = await requireUserId(event)
  const now = new Date()
  const isTestUser = userId === TEST_USER_ID
  // 用户组锁定：被分配用户组后 storageLimit/uploadChunkSize 不可手动修改
  const group = await getUserGroup(userId)

  for (const key of ALLOWED_KEYS) {
    if (body[key] === undefined) continue
    // 测试用户不允许修改存储上限（固定 100MB）
    if (isTestUser && key === 'storageLimit') continue
    // 用户组管理项不可手动修改
    if (group && GROUP_MANAGED_KEYS.includes(key)) continue
    const value = JSON.stringify(body[key])

    const existing = await db.select().from(userSettings)
      .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)))
      .limit(1)

    if (existing[0]) {
      await db.update(userSettings)
        .set({ value, updatedAt: now })
        .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)))
    } else {
      await db.insert(userSettings).values({
        id: crypto.randomUUID(),
        userId,
        key,
        value,
        updatedAt: now
      })
    }
  }

  return { ok: true }
})
