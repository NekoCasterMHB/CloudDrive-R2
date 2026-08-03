// POST /api/shares — 创建分享（支持文件/文件夹混选）
import { db } from '@nuxthub/db'
import { shares, files as filesTable, folders as foldersTable } from '../../database/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { generateShareToken, hashSharePassword } from '../../utils/share'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody(event)
  const items = body?.items // [{ id, type }]
  if (!Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, message: '请选择要分享的项目' })
  }

  // 去重（同 id+type）
  const seen = new Set<string>()
  const uniq = items.filter((i: any) => {
    if (!i || typeof i.id !== 'string' || !['file', 'folder'].includes(i.type)) return false
    const k = `${i.type}:${i.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (uniq.length === 0) throw createError({ statusCode: 400, message: '请选择要分享的项目' })

  // 校验归属：文件与文件夹都必须属于当前用户
  const fileIds = uniq.filter((i: any) => i.type === 'file').map((i: any) => i.id)
  const folderIds = uniq.filter((i: any) => i.type === 'folder').map((i: any) => i.id)

  let ownedFiles: { id: string, filename: string }[] = []
  let ownedFolders: { id: string, name: string }[] = []
  if (fileIds.length) {
    ownedFiles = await db.select({ id: filesTable.id, filename: filesTable.filename }).from(filesTable)
      .where(and(inArray(filesTable.id, fileIds), eq(filesTable.userId, userId)))
  }
  if (folderIds.length) {
    ownedFolders = await db.select({ id: foldersTable.id, name: foldersTable.name }).from(foldersTable)
      .where(and(inArray(foldersTable.id, folderIds), eq(foldersTable.userId, userId)))
  }
  if (ownedFiles.length + ownedFolders.length !== uniq.length) {
    throw createError({ statusCode: 403, message: '包含不属于你的项目' })
  }

  const itemMeta = [
    ...ownedFiles.map(f => ({ id: f.id, type: 'file' as const, name: f.filename })),
    ...ownedFolders.map(f => ({ id: f.id, type: 'folder' as const, name: f.name }))
  ]

  // 可选密码
  let passwordHash: string | null = null
  let passwordPlain: string | null = null
  if (body.password) {
    const pwd = String(body.password)
    if (pwd.length < 4) throw createError({ statusCode: 400, message: '密码至少 4 位' })
    passwordHash = await hashSharePassword(pwd)
    passwordPlain = pwd // 保存明文，供分享管理展示/复制（校验仍用哈希）
  }

  // 可选有效期（小时）；不传 / <=0 表示永久
  let expiresAt: Date | null = null
  const hours = Number(body.expiresHours)
  if (Number.isFinite(hours) && hours > 0) {
    expiresAt = new Date(Date.now() + hours * 3600 * 1000)
  }

  const token = generateShareToken()
  const now = new Date()
  await db.insert(shares).values({
    id: crypto.randomUUID(),
    userId,
    token,
    password: passwordHash,
    passwordPlain,
    expiresAt,
    items: JSON.stringify(itemMeta),
    createdAt: now
  }).run()

  return {
    token,
    expiresAt: expiresAt ? expiresAt.getTime() : null,
    hasPassword: !!passwordHash
  }
})
