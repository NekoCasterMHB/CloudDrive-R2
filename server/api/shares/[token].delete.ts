// DELETE /api/shares/:token — 取消分享（仅创建者可取消）
import { db } from '@nuxthub/db'
import { shares } from '../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: '缺少参数' })

  const row = await db.select().from(shares)
    .where(and(eq(shares.token, token), eq(shares.userId, userId)))
    .limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '分享不存在' })

  await db.delete(shares).where(eq(shares.id, row.id)).run()
  return { success: true }
})
