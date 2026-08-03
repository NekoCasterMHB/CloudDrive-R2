// POST /api/admin/groups — 创建用户组，仅管理员
import { db } from '@nuxthub/db'
import { userGroups } from '../../database/schema'
import { requireAdmin } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const name = String(body?.name ?? '').trim()
  if (!name) throw createError({ statusCode: 400, message: '请输入用户组名称' })

  const storageLimit = Number.isFinite(Number(body?.storageLimit)) ? Math.max(0, Number(body?.storageLimit)) : 0
  const canChangePassword = body?.canChangePassword !== false
  const uploadChunkSize = Number.isFinite(Number(body?.uploadChunkSize)) ? Math.max(0, Number(body?.uploadChunkSize)) : 10 * 1024 * 1024

  const now = new Date()
  const id = crypto.randomUUID()
  await db.insert(userGroups).values({
    id,
    name,
    storageLimit,
    canChangePassword,
    uploadChunkSize,
    createdAt: now,
    updatedAt: now
  }).run()
  return { id }
})
