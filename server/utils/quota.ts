// 存储配额辅助：统一计算用户实际占用（files + trash + 进行中的上传会话）与配额，
// 供 /api/storage/usage 展示与上传拦截（/api/upload/init）复用
import { db } from '../database'
import { files, trash, uploadSessions, userSettings } from '../database/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { getUserGroup } from './group'
import { TEST_USER_ID, TEST_USER_LIMIT } from './user'

const DEFAULT_LIMIT = 1024 * 1024 * 1024 * 1024 // 默认 1TB

export interface StorageQuota {
  used: number
  limit: number // 0 = 无限制
}

/** 计算用户存储占用与配额 */
export async function getStorageQuota(userId: string): Promise<StorageQuota> {
  // 实际占用 = files 表（未删除）+ trash 表（回收站尚未永久清除）
  // + 所有进行中的上传会话（pending/uploading，未 complete）的大小总和。
  // - 移入回收站只是把记录从 files 挪到 trash，R2 对象仍在，因此使用量不释放；
  //   直到回收站清除（永久删除/清空，同时删除 R2 对象）才真正释放，避免回收站无限囤积。
  // - 上传会话计入占用：每个已 init 的会话立即占用空间（其 R2 分片也真实占存储），
  //   后续 init 能看到累积占用，从而拦截「单文件不超、总和超限」的并发/囤积绕过。
  //   会话的释放由：上传失败/取消自动 abort、清空回收站一并清理、init 时清理过期会话负责。
  const [filesRow] = await db.select({
    used: sql<number>`COALESCE(SUM(${files.size}), 0)`
  }).from(files).where(eq(files.userId, userId))
  const [trashRow] = await db.select({
    used: sql<number>`COALESCE(SUM(${trash.size}), 0)`
  }).from(trash).where(eq(trash.userId, userId))
  const [sessionRow] = await db.select({
    used: sql<number>`COALESCE(SUM(${uploadSessions.fileSize}), 0)`
  }).from(uploadSessions).where(
    and(eq(uploadSessions.userId, userId), inArray(uploadSessions.status, ['pending', 'uploading']))
  )
  const used = Number(filesRow?.used ?? 0) + Number(trashRow?.used ?? 0) + Number(sessionRow?.used ?? 0)

  // 配额优先级：测试用户固定 100MB → 用户组 storageLimit（0=无限制）→ 个人设置 → 默认 1TB
  let limit = DEFAULT_LIMIT
  if (userId === TEST_USER_ID) {
    limit = TEST_USER_LIMIT
  } else {
    const group = await getUserGroup(userId)
    if (group) {
      limit = group.storageLimit
    } else {
      const limitRow = await db.select().from(userSettings)
        .where(and(eq(userSettings.userId, userId), eq(userSettings.key, 'storageLimit')))
        .limit(1)
      if (limitRow[0]) {
        try {
          const v = Number(JSON.parse(limitRow[0].value))
          if (Number.isFinite(v) && v >= 0) limit = v
        } catch {
          // 使用默认值
        }
      }
    }
  }

  return { used, limit }
}
