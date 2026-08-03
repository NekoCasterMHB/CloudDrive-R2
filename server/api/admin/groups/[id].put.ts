// PUT /api/admin/groups/:id — 更新用户组配置，仅管理员
import { db } from '@nuxthub/db'
import { userGroups } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少用户组 id' })

  const body = await readBody(event)
  const existing = await db.select().from(userGroups).where(eq(userGroups.id, id)).limit(1)
  if (!existing[0]) throw createError({ statusCode: 404, message: '用户组不存在' })

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) throw createError({ statusCode: 400, message: '请输入用户组名称' })
    patch.name = name
  }
  if (body?.storageLimit !== undefined && Number.isFinite(Number(body.storageLimit))) {
    patch.storageLimit = Math.max(0, Number(body.storageLimit))
  }
  if (body?.canChangePassword !== undefined) {
    patch.canChangePassword = body.canChangePassword !== false
  }
  if (body?.uploadChunkSize !== undefined && Number.isFinite(Number(body.uploadChunkSize))) {
    patch.uploadChunkSize = Math.max(0, Number(body.uploadChunkSize))
  }

  await db.update(userGroups).set(patch).where(eq(userGroups.id, id))
  return { ok: true }
})
