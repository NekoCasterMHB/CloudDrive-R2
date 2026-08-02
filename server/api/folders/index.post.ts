import { db } from '@nuxthub/db'
import { folders as foldersTable } from '../../database/schema'
import { eq, and, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { name, parentId } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '文件夹名称不能为空' })

  const userId = await requireUserId(event)
  const id = crypto.randomUUID()
  const now = Date.now()

  // 查重
  const existing = await db.select().from(foldersTable).where(
    parentId
      ? and(eq(foldersTable.userId, userId), eq(foldersTable.parentId, parentId), eq(foldersTable.name, name))
      : and(eq(foldersTable.userId, userId), isNull(foldersTable.parentId), eq(foldersTable.name, name))
  ).all()
  if (existing.length) throw createError({ statusCode: 409, message: '同名文件夹已存在' })

  await db.insert(foldersTable).values({
    id, userId, parentId: parentId ?? null, name,
    createdAt: new Date(now), updatedAt: new Date(now)
  }).run()

  return { id, name, parentId: parentId ?? null, createdAt: now }
})
