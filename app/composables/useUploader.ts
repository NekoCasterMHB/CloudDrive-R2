/**
 * 文件上传 composable
 * 支持小文件直传 / 大文件分片上传
 */
import { useFileCache } from './useFileCache'

export interface UploadTask {
  id: string
  file: File
  folderId: string | null
  type: 'upload' | 'download'
  status: 'pending' | 'uploading' | 'done' | 'error' | 'paused' | 'cancelled'
  progress: number
  sessionId?: string // R2 Multipart Upload 会话（断点续传）
  uploadedBytes?: number
  error?: string
}

export interface StoredTask {
  id: string
  fileName: string
  fileSize: number
  folderId: string | null
  type: 'upload' | 'download'
  status: 'done' | 'error' | 'paused' | 'cancelled'
  error?: string
  time: number
}

export function useUploader(onDone?: (record?: any) => void, onNotify?: (msg: { title: string, color?: string, icon?: string }) => void) {
  const tasks = ref<UploadTask[]>([])
  const history = ref<StoredTask[]>(loadHistory())
  // 用于上传完成后将文件写入本地缓存（缩略图显示"已缓存"绿点）
  const { cacheFile } = useFileCache()
  const maxConcurrent = 2
  // 任务级 AbortController（暂停/取消）
  const taskControllers = new Map<string, AbortController>()

  function loadHistory(): StoredTask[] {
    let items: StoredTask[] = []
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('upload_history')
        if (raw) items = JSON.parse(raw)
      }
    } catch {
      // localStorage 数据损坏时忽略
    }
    return items
  }

  function saveHistory() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem('upload_history', JSON.stringify(history.value.slice(0, 100)))
  }

  /** 添加文件到上传队列 */
  function addFiles(files: File[], folderId: string | null) {
    for (const file of files) {
      tasks.value.push({
        id: crypto.randomUUID(),
        file,
        folderId,
        type: 'upload',
        status: 'pending',
        progress: 0
      })
    }
    processQueue()
  }

  /** 处理上传队列（demo 模拟任务不占用并发槽位） */
  async function processQueue() {
    const pending: UploadTask[] = tasks.value.filter(t => (t.status === 'pending' || t.status === 'paused') && !t.id.startsWith('demo-'))
    const running: UploadTask[] = tasks.value.filter(t => t.status === 'uploading' && !t.id.startsWith('demo-'))
    const slots = maxConcurrent - running.length
    for (const t of pending) {
      if (slots <= 0) break
      uploadFile(t)
    }
  }

  /** 按文件大小选择分片并发数（文档策略） */
  function getConcurrency(size: number): number {
    if (size < 100 * 1024 * 1024) return 3
    if (size < 1024 * 1024 * 1024) return 5
    if (size < 10 * 1024 * 1024 * 1024) return 8
    return 10
  }

  /**
   * 上传单个文件（R2 Multipart Upload：init → 分片直传 → complete）
   * 支持断点续传：已有 sessionId 时复用，跳过已完成分片
   */
  async function uploadFile(task: UploadTask) {
    task.status = 'uploading'
    const controller = new AbortController()
    taskControllers.set(task.id, controller)
    task.uploadedBytes = task.uploadedBytes || 0

    try {
      // Step 1: 初始化（或复用已有会话实现断点续传）
      let sessionId: string | undefined = task.sessionId
      let partSize = 10 * 1024 * 1024
      if (!sessionId) {
        const init = await $fetch<any>('/api/upload/init', {
          method: 'POST',
          body: {
            filename: task.file.name,
            size: task.file.size,
            contentType: task.file.type,
            folderId: task.folderId
          }
        })
        sessionId = init.sessionId
        partSize = init.partSize
        task.sessionId = sessionId
      } else {
        // 断点续传：查询已完成分片
        try {
          const sess = await $fetch<any>(`/api/upload/session/${sessionId}`)
          if (sess.session?.partSize) partSize = sess.session.partSize
          const done = new Set((sess.completedParts || []).map((p: any) => p.partNumber))
          // 进度恢复到已完成分片
          const uploadedChunks = Array.from(done).length
          task.uploadedBytes = Math.min(uploadedChunks * partSize, task.file.size)
          task.progress = Math.min(99, Math.round((task.uploadedBytes / task.file.size) * 100))
        } catch {
          // 查询会话失败时忽略（继续从 0 开始）
        }
      }

      const totalParts = Math.max(1, Math.ceil(task.file.size / partSize))

      // 查询已完成分片（新会话为空）
      let doneParts = new Set<number>()
      if (sessionId) {
        try {
          const sess = await $fetch<any>(`/api/upload/session/${sessionId}`)
          doneParts = new Set((sess.completedParts || []).map((p: any) => p.partNumber))
        } catch {
          // 查询已完成分片失败时忽略（重新上传）
        }
      }

      // Step 2: 并发上传分片（POST 到 Worker，经 R2 binding 代理上传）
      // 用 XMLHttpRequest 获取真实上传进度：fetch 无法追踪上传进度，
      // 小文件（单分片）之前会 0 → 99 跳变
      const uploadPart = (partNumber: number) => new Promise<any>((resolve, reject) => {
        const start = (partNumber - 1) * partSize
        const end = Math.min(start + partSize, task.file.size)
        const chunk = task.file.slice(start, end, task.file.type)

        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/upload/part?sessionId=${encodeURIComponent(sessionId!)}&partNumber=${partNumber}`)
        xhr.responseType = 'json'

        const updateProgress = (partSent: number) => {
          const totalUploaded = Math.min(start + partSent, task.file.size)
          task.uploadedBytes = Math.max(task.uploadedBytes || 0, totalUploaded)
          task.progress = Math.min(99, Math.round((task.uploadedBytes / task.file.size) * 100))
        }

        // 分片开始发送时先给基线进度，避免长时间停在 0
        xhr.upload.onloadstart = () => updateProgress(0)
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) updateProgress(ev.loaded)
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response)
          else reject(new Error(`分片 ${partNumber} 上传失败: ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error(`分片 ${partNumber} 网络错误`))
        xhr.onabort = () => reject(new Error('aborted'))
        const onAbort = () => xhr.abort()
        controller.signal.addEventListener('abort', onAbort, { once: true })

        xhr.send(chunk)
      })

      const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1).filter(p => !doneParts.has(p))
      const concurrency = getConcurrency(task.file.size)
      for (let i = 0; i < partNumbers.length; i += concurrency) {
        if (controller.signal.aborted) break
        const batch = partNumbers.slice(i, i + concurrency)
        await Promise.all(batch.map(async (partNumber) => {
          const partRes = await uploadPart(partNumber)
          if (!partRes?.etag) throw new Error(`分片 ${partNumber} 上传失败`)
          const etag = (partRes.etag || '').replace(/"/g, '')
          await $fetch('/api/upload/part-complete', {
            method: 'POST',
            body: {
              sessionId,
              partNumber,
              etag,
              size: Math.min(partSize, task.file.size - (partNumber - 1) * partSize)
            }
          })
        }))
      }

      if (controller.signal.aborted) return // 被暂停/取消

      // Step 3: 完成上传
      const uploadRes = await $fetch<any>('/api/upload/complete', {
        method: 'POST',
        body: { sessionId }
      })
      task.progress = 100
      task.status = 'done'
      // 上传完成后立即将文件写入本地缓存（受缓存设置约束：类型 + 最大容量），
      // 这样刚上传的文件缩略图能立刻显示"已缓存"绿点；缓存失败不影响上传结果
      if (uploadRes?.id) {
        try {
          await cacheFile({
            id: uploadRes.id,
            name: task.file.name,
            contentType: task.file.type || uploadRes.contentType || 'application/octet-stream',
            blob: task.file
          })
        } catch {
          // 忽略缓存写入失败
        }
      }
      taskControllers.delete(task.id)
      history.value.unshift({
        id: task.id,
        fileName: task.file.name,
        fileSize: task.file.size,
        folderId: task.folderId,
        type: task.type,
        status: 'done',
        time: Date.now()
      })
      if (history.value.length > 100) history.value.pop()
      saveHistory()
      onNotify?.({ title: `${task.file.name} 上传完成`, icon: 'i-lucide-circle-check' })
      onDone?.(uploadRes)
    } catch (e: any) {
      taskControllers.delete(task.id)
      // 被暂停/取消时静默处理
      if (controller.signal.aborted && task.status !== 'done') {
        // 状态已在 togglePause / cancelTask 中设置
        processQueue()
        return
      }
      task.status = 'error'
      task.error = e?.message || 'Upload failed'
      history.value.unshift({
        id: task.id,
        fileName: task.file.name,
        fileSize: task.file.size,
        folderId: task.folderId,
        type: task.type,
        status: 'error',
        error: e?.message || 'Upload failed',
        time: Date.now()
      })
      if (history.value.length > 100) history.value.pop()
      saveHistory()
      onNotify?.({ title: `${task.file.name} 上传失败`, color: 'error', icon: 'i-lucide-circle-x' })
    }

    // 继续处理队列
    processQueue()
  }

  /** 暂停/继续任务（AbortController 中断，断点续传恢复） */
  function togglePause(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    if (task.status === 'uploading') {
      taskControllers.get(id)?.abort()
      taskControllers.delete(id)
      task.status = 'paused'
      onNotify?.({ title: `${task.file.name} 已暂停`, icon: 'i-lucide-pause' })
      processQueue()
    } else if (task.status === 'paused') {
      task.status = 'uploading'
      onNotify?.({ title: `${task.file.name} 已继续`, icon: 'i-lucide-play' })
      uploadFile(task)
    }
  }

  /** 取消任务（中止 R2 Multipart 并清理会话） */
  function cancelTask(id: string) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const task = tasks.value[idx]
    taskControllers.get(id)?.abort()
    taskControllers.delete(id)
    // 通知后端中止 Multipart 会话
    if (task.sessionId) {
      $fetch('/api/upload/abort', { method: 'POST', body: { sessionId: task.sessionId } }).catch(() => {})
    }
    tasks.value.splice(idx, 1)
    history.value.unshift({
      id: task.id,
      fileName: task.file.name,
      fileSize: task.file.size,
      folderId: task.folderId,
      type: task.type,
      status: 'cancelled',
      time: Date.now()
    })
    if (history.value.length > 100) history.value.pop()
    saveHistory()
    onNotify?.({ title: `${task.file.name} 已取消`, icon: 'i-lucide-x' })
  }

  /** 移除已完成/失败的任务 */
  function clearDone() {
    tasks.value = tasks.value.filter(t => t.status === 'pending' || t.status === 'uploading')
  }

  /** 清空历史记录 */
  function clearHistory() {
    history.value = []
    saveHistory()
    onNotify?.({ title: '历史记录已清空', icon: 'i-lucide-trash-2' })
  }

  /** 删除单条历史记录 */
  function removeHistory(id: string) {
    const item = history.value.find(h => h.id === id)
    history.value = history.value.filter(h => h.id !== id)
    saveHistory()
    onNotify?.({ title: `${item?.fileName || '任务'} 已删除`, icon: 'i-lucide-trash-2' })
  }

  return { tasks, history, addFiles, clearDone, clearHistory, removeHistory, togglePause, cancelTask, saveHistory }
}
