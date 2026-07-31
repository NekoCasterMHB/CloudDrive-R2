// PATCH /api/files/:id — 重命名文件（仅改 filename，R2 objectKey 不变）
import { db } from '@nuxthub/db'
import { files as filesTable } from '../../database/schema'
import { eq, and, isNull, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { name } = await readBody(event)
  const userId = 'mock-user-id'

  if (!name?.trim()) throw createError({ statusCode: 400, message: '文件名不能为空' })
  if (name.includes('/')) throw createError({ statusCode: 400, message: '名称不能包含 / 字符' })

  const file = await db.select().from(filesTable).where(
    and(eq(filesTable.id, id), eq(filesTable.userId, userId))
  ).limit(1).then(r => r[0])
  if (!file) throw createError({ statusCode: 404, message: '文件不存在' })

  // 查重：同 folderId 下的其他同名文件
  const existing = await db.select().from(filesTable).where(
    file.folderId
      ? and(eq(filesTable.userId, userId), eq(filesTable.folderId, file.folderId), eq(filesTable.filename, name), ne(filesTable.id, id))
      : and(eq(filesTable.userId, userId), isNull(filesTable.folderId), eq(filesTable.filename, name), ne(filesTable.id, id))
  ).all()
  if (existing.length) throw createError({ statusCode: 409, message: '当前目录已存在同名文件' })

  await db.update(filesTable).set({ filename: name, updatedAt: new Date() }).where(eq(filesTable.id, id)).run()

  return await db.select().from(filesTable).where(eq(filesTable.id, id)).limit(1).then(r => r[0])
})
