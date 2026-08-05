// 上传会话清理：清理超期未完成的孤儿上传会话（用户 init 后放弃、未 complete 也未 abort），
// 中止 R2 分片并移除记录，释放配额占用（配额把进行中的会话计入 used）。
import { db } from '../database'
import { uploadSessions, uploadParts } from '../database/schema'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { r2AbortMultipartUpload } from './r2'

const STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 天未完成视为孤儿会话

/** 清理指定用户超期未完成的孤儿上传会话，返回清理条数 */
export async function cleanupStaleSessions(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS)
  const stale = await db.select().from(uploadSessions).where(
    and(
      eq(uploadSessions.userId, userId),
      inArray(uploadSessions.status, ['pending', 'uploading']),
      lt(uploadSessions.createdAt, cutoff)
    )
  )
  let removed = 0
  for (const s of stale) {
    try {
      await r2AbortMultipartUpload(s.uploadId, s.objectKey)
    } catch {
      // R2 Multipart 会话可能已失效，忽略
    }
    await db.delete(uploadParts).where(eq(uploadParts.sessionId, s.id)).run()
    await db.delete(uploadSessions).where(eq(uploadSessions.id, s.id)).run()
    removed++
  }
  return removed
}
