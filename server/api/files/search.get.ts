import { db } from '@nuxthub/db'
import { files as filesTable, folders as foldersTable } from '../../database/schema'
import { like, eq, and, inArray } from 'drizzle-orm'
import { getDB } from '../../utils/bindings'

export default defineEventHandler(async (event) => {
  const { q, scope, folderId } = getQuery(event)

  if (!q || typeof q !== 'string' || !q.trim()) {
    return { files: [], folders: [] }
  }

  const query = `%${q.trim()}%`
  const userId = await requireUserId(event)

  try {
    if (scope === 'all') {
      const [fileResults, folderResults] = await Promise.all([
        db.select().from(filesTable)
          .where(and(eq(filesTable.userId, userId), like(filesTable.filename, query)))
          .orderBy(filesTable.filename).limit(50).all(),
        db.select().from(foldersTable)
          .where(and(eq(foldersTable.userId, userId), like(foldersTable.name, query)))
          .orderBy(foldersTable.name).limit(50).all()
      ])
      return { files: fileResults, folders: folderResults }
    }

    // scope === 'sub': current folder + subfolders
    const parentId = (folderId as string) || null

    // Root level — same as 'all' for sub scope
    if (!parentId) {
      const [fileResults, folderResults] = await Promise.all([
        db.select().from(filesTable)
          .where(and(eq(filesTable.userId, userId), like(filesTable.filename, query)))
          .orderBy(filesTable.filename).limit(50).all(),
        db.select().from(foldersTable)
          .where(and(eq(foldersTable.userId, userId), like(foldersTable.name, query)))
          .orderBy(foldersTable.name).limit(50).all()
      ])
      return { files: fileResults, folders: folderResults }
    }

    // Subfolder — 递归 CTE 通过 D1 binding（env.DB）查询
    const d1 = getDB()
    const stmt = await d1.prepare(
      'WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id = ?1 UNION ALL SELECT f.id FROM folders f INNER JOIN sub ON f.parent_id = sub.id) SELECT id AS id FROM sub'
    ).bind(parentId).all()
    const subIds = (stmt.results || []).map((row: any) => row.id as string)
    const folderIds = [parentId, ...subIds]
    const [fileResults, folderResults] = await Promise.all([
      db.select().from(filesTable)
        .where(and(eq(filesTable.userId, userId), inArray(filesTable.folderId, folderIds), like(filesTable.filename, query)))
        .orderBy(filesTable.filename).limit(50).all(),
      db.select().from(foldersTable)
        .where(and(eq(foldersTable.userId, userId), inArray(foldersTable.parentId, folderIds), like(foldersTable.name, query)))
        .orderBy(foldersTable.name).limit(50).all()
    ])
    return { files: fileResults, folders: folderResults }
  } catch (e) {
    console.error('[search]', e)
    return { files: [], folders: [] }
  }
})
