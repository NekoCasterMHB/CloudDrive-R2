import { db } from '@nuxthub/db'
import { files as filesTable, folders as foldersTable } from '../../database/schema'
import { like, eq, and, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { q, scope, folderId } = getQuery(event)

  if (!q || typeof q !== 'string' || !q.trim()) {
    return { files: [], folders: [] }
  }

  const query = `%${q.trim()}%`
  // TODO: real userId from session
  const userId = 'mock-user-id'

  try {
    if (scope === 'all') {
      const [fileResults, folderResults] = await Promise.all([
        db.select().from(filesTable)
          .where(and(eq(filesTable.userId, userId), like(filesTable.filename, query)))
          .orderBy(filesTable.filename).limit(50).all(),
        db.select().from(foldersTable)
          .where(and(eq(foldersTable.userId, userId), like(foldersTable.name, query)))
          .orderBy(foldersTable.name).limit(50).all(),
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
          .orderBy(foldersTable.name).limit(50).all(),
      ])
      return { files: fileResults, folders: folderResults }
    }

    // Subfolder — recursive CTE via direct D1 API (d1-http driver doesn't support CTE params)
    const config = useRuntimeConfig()
    const d1Result = await $fetch<{ result: { results: { rows: string[][] } }[] }>(
      `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/d1/database/${process.env.NUXT_HUB_CLOUDFLARE_DATABASE_ID}/raw`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NUXT_HUB_CLOUDFLARE_API_TOKEN}` },
        body: {
          sql: 'WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id = ?1 UNION ALL SELECT f.id FROM folders f INNER JOIN sub ON f.parent_id = sub.id) SELECT id FROM sub',
          params: [parentId],
        },
      },
    )
    const subIds = d1Result.result[0]?.results?.rows?.map((row: string[]) => row[0]) ?? []
    const folderIds = [parentId, ...subIds]
    const [fileResults, folderResults] = await Promise.all([
      db.select().from(filesTable)
        .where(and(eq(filesTable.userId, userId), inArray(filesTable.folderId, folderIds), like(filesTable.filename, query)))
        .orderBy(filesTable.filename).limit(50).all(),
      db.select().from(foldersTable)
        .where(and(eq(foldersTable.userId, userId), inArray(foldersTable.parentId, folderIds), like(foldersTable.name, query)))
        .orderBy(foldersTable.name).limit(50).all(),
    ])
    return { files: fileResults, folders: folderResults }
  }
  catch (e) {
    console.error('[search]', e)
    return { files: [], folders: [] }
  }
})
