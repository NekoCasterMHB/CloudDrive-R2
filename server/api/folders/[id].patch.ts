// PATCH /api/folders/:id — 重命名文件夹
import { db } from '@nuxthub/db'
import { folders as foldersTable } from '../../database/schema'
import { eq, and, isNull, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { name } = await readBody(event)
  const userId = 'mock-user-id'

  if (!name?.trim()) throw createError({ statusCode: 400, message: '文件夹名称不能为空' })
  if (name.includes('/')) throw createError({ statusCode: 400, message: '名称不能包含 / 字符' })

  const folder = await db.select().from(foldersTable).where(
    and(eq(foldersTable.id, id), eq(foldersTable.userId, userId))
  ).limit(1).then(r => r[0])
  if (!folder) throw createError({ statusCode: 404, message: '文件夹不存在' })

  // 查重：同 parentId 下的其他同名文件夹
  const existing = await db.select().from(foldersTable).where(
    folder.parentId
      ? and(eq(foldersTable.userId, userId), eq(foldersTable.parentId, folder.parentId), eq(foldersTable.name, name), ne(foldersTable.id, id))
      : and(eq(foldersTable.userId, userId), isNull(foldersTable.parentId), eq(foldersTable.name, name), ne(foldersTable.id, id))
  ).all()
  if (existing.length) throw createError({ statusCode: 409, message: '当前目录已存在同名文件夹' })

  await db.update(foldersTable).set({ name, updatedAt: new Date() }).where(eq(foldersTable.id, id)).run()

  return await db.select().from(foldersTable).where(eq(foldersTable.id, id)).limit(1).then(r => r[0])
})
