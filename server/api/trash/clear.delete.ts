// DELETE /api/trash/clear — 清空回收站（永久删除所有记录与 R2 对象，不可恢复）
// 同时清理该用户所有未完成的上传会话，释放中断/失败上传占用的配额。
// 响应为 application/x-ndjson 流式进度：每行 { done, total }，结束行 { type:'done', ...统计 } 或 { type:'error', message }
import { r2AbortMultipartUpload, r2Delete } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { db } = await import('@nuxthub/db')
  const { files, folders, trash, uploadParts, uploadSessions } = await import('../../database/schema')
  const { and, eq, inArray } = await import('drizzle-orm')

  const items = await db.select().from(trash).where(eq(trash.userId, userId))
  // 孤儿文件（指向已不存在文件夹的历史残留）
  const folderRows = await db.select({ id: folders.id }).from(folders).where(eq(folders.userId, userId))
  const folderIds = new Set(folderRows.map(f => f.id))
  const userFiles = await db.select().from(files).where(eq(files.userId, userId))
  const orphanFiles = userFiles.filter(f => f.folderId && !folderIds.has(f.folderId))
  // 未完成的上传会话
  const sessions = await db.select().from(uploadSessions).where(
    and(eq(uploadSessions.userId, userId), inArray(uploadSessions.status, ['pending', 'uploading']))
  )

  // 需要逐个 R2 操作的数量（trash 带对象 + 孤儿文件 + 会话 abort）
  const total = items.filter(i => i.objectKey).length + orphanFiles.length + sessions.length
  let done = 0
  // D1 每查询绑定参数上限为 100 → inArray 每批最多 100 个 id
  const BATCH = 100

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'))
      }
      const tick = () => {
        done++
        // 每 20 个或最后一批上报一次进度，避免刷屏
        if (done % 20 === 0 || done === total) send({ done, total })
      }
      try {
        let failedCount = 0
        let deletedCount = 0
        let orphanCount = 0
        let sessionCount = 0

        // 1) 回收站：逐个删 R2 对象（R2 binding 不支持跨对象批量），成功后批量删 D1 记录
        const trashDeleted: string[] = []
        for (const row of items) {
          if (row.objectKey) {
            try {
              await r2Delete(row.objectKey)
            } catch {
              failedCount++
              continue
            }
          }
          trashDeleted.push(row.id)
          deletedCount++
          tick()
        }
        for (let i = 0; i < trashDeleted.length; i += BATCH) {
          await db.delete(trash).where(inArray(trash.id, trashDeleted.slice(i, i + BATCH)))
        }

        // 2) 孤儿文件：逐个删 R2，成功后批量删 D1 记录
        const orphanDeleted: string[] = []
        for (const f of orphanFiles) {
          try {
            await r2Delete(f.objectKey)
          } catch {
            failedCount++
            continue
          }
          orphanDeleted.push(f.id)
          orphanCount++
          tick()
        }
        for (let i = 0; i < orphanDeleted.length; i += BATCH) {
          await db.delete(files).where(inArray(files.id, orphanDeleted.slice(i, i + BATCH)))
        }

        // 3) 上传会话：逐个 abort R2 分片，成功后批量删分片表与会话
        const sessionIds: string[] = []
        for (const s of sessions) {
          try {
            await r2AbortMultipartUpload(s.uploadId, s.objectKey)
          } catch {
            // R2 Multipart 会话可能已失效，忽略
          }
          sessionIds.push(s.id)
          sessionCount++
          tick()
        }
        for (let i = 0; i < sessionIds.length; i += BATCH) {
          const batch = sessionIds.slice(i, i + BATCH)
          await db.delete(uploadParts).where(inArray(uploadParts.sessionId, batch))
          await db.delete(uploadSessions).where(inArray(uploadSessions.id, batch))
        }

        send({ type: 'done', done: total, total, deletedCount, orphanCount, sessionCount, failedCount })
        controller.close()
      } catch (e: any) {
        send({ type: 'error', message: e?.message || '清空失败' })
        controller.close()
      }
    }
  })

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson')
  return new Response(stream)
})
