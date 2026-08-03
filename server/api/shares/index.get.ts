// GET /api/shares — 我的分享列表
import { db } from '@nuxthub/db'
import { shares } from '../../database/schema'
import { eq, desc } from 'drizzle-orm'
import { parseShareItems } from '../../utils/share'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const rows = await db.select().from(shares)
    .where(eq(shares.userId, userId))
    .orderBy(desc(shares.createdAt))
    .limit(100)

  return {
    shares: rows.map(r => ({
      token: r.token,
      items: parseShareItems(r.items),
      hasPassword: !!r.password,
      password: r.passwordPlain ?? null,
      expiresAt: r.expiresAt ? new Date(r.expiresAt).getTime() : null,
      createdAt: new Date(r.createdAt).getTime(),
      expired: !!r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()
    }))
  }
})
