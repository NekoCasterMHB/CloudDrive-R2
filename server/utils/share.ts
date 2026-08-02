// 分享相关工具：token 生成、密码哈希、cookie 授权、有效性校验
import { db } from '@nuxthub/db'
import { shares, files as filesTable, folders as foldersTable } from '../database/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword } from 'better-auth/crypto'

/** 生成短分享码（base62，10 位） */
export function generateShareToken(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/** 已授权的分享 token 列表（share_ok cookie，逗号分隔） */
export function getShareAuthTokens(event: any): string[] {
  const raw = getCookie(event, 'share_ok') || ''
  return raw.split(',').filter(Boolean)
}

/** 是否已授权访问该分享（无密码分享恒为 true） */
export function isShareAuthorized(event: any, token: string, hasPassword: boolean): boolean {
  if (!hasPassword) return true
  return getShareAuthTokens(event).includes(token)
}

/** 记录该分享已通过密码校验 */
export function addShareAuth(event: any, token: string) {
  const existing = getShareAuthTokens(event)
  if (!existing.includes(token)) existing.push(token)
  setCookie(event, 'share_ok', existing.join(','), {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7
  })
}

export interface ShareItem {
  id: string
  type: 'file' | 'folder'
  name: string
}

/** 查询分享并校验存在 / 未过期 */
export async function getValidShare(event: any, token: string) {
  const row = await db.select().from(shares).where(eq(shares.token, token)).limit(1).then(r => r[0])
  if (!row) throw createError({ statusCode: 404, message: '分享不存在' })
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    throw createError({ statusCode: 410, message: '分享已过期' })
  }
  return row
}

/** 解析分享 items JSON */
export function parseShareItems(raw: string): ShareItem[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 检查文件夹 id 是否位于给定分享文件夹集合的树内 */
export async function isFolderWithinShares(folderId: string, sharedFolderIds: Set<string>): Promise<boolean> {
  let cur: string | null = folderId
  const guard = new Set<string>()
  while (cur) {
    if (sharedFolderIds.has(cur)) return true
    if (guard.has(cur)) return false
    guard.add(cur)
    const f = await db.select({ parentId: foldersTable.parentId }).from(foldersTable)
      .where(eq(foldersTable.id, cur)).limit(1).then(r => r[0])
    if (!f) return false
    cur = f.parentId ?? null
  }
  return false
}

/** 检查文件是否属于分享范围（直接分享的文件 或 分享文件夹树内） */
export async function isFileWithinShares(fileId: string, sharedFolderIds: Set<string>, sharedFileIds: Set<string>): Promise<boolean> {
  if (sharedFileIds.has(fileId)) return true
  const f = await db.select({ folderId: filesTable.folderId }).from(filesTable)
    .where(eq(filesTable.id, fileId)).limit(1).then(r => r[0])
  if (!f || !f.folderId) return false
  return isFolderWithinShares(f.folderId, sharedFolderIds)
}

/** 密码哈希（better-auth/crypto，scrypt 格式） */
export async function hashSharePassword(pwd: string): Promise<string> {
  return hashPassword(pwd)
}

export async function verifySharePassword(hash: string, pwd: string): Promise<boolean> {
  try {
    return await verifyPassword({ hash, password: pwd })
  } catch {
    return false
  }
}
