// PUT /api/settings — 更新部分用户设置（仅保存传入的 key，upsert 到 D1）
import { db } from '@nuxthub/db'
import { userSettings } from '../../database/schema'
import { and, eq } from 'drizzle-orm'
import { SETTINGS_DEFAULTS } from './index.get'

const ALLOWED_KEYS = Object.keys(SETTINGS_DEFAULTS)

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '无效的设置数据' })
  }

  // TODO: real userId from session
  const userId = await requireUserId(event)
  const now = new Date()
  const isTestUser = userId === TEST_USER_ID

  for (const key of ALLOWED_KEYS) {
    if (body[key] === undefined) continue
    // 测试用户不允许修改存储上限（固定 100MB）
    if (isTestUser && key === 'storageLimit') continue
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
