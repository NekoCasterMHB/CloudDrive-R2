/**
 * 文件上传 composable
 * 支持小文件直传 / 大文件分片上传
 */
import { useFileCache } from './useFileCache'
import { useSettings } from './useSettings'
import { trackSpeed } from '~/utils/speed'

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
  speed?: number // 瞬时传输速度（B/s）
  completing?: boolean // 分片已传完，正在服务端合并（complete 阶段）
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

// ===== 传输历史 IndexedDB 持久化（替代 localStorage，无条数限制）=====
const HISTORY_DB = 'clouddrive-transfer-history'
const HISTORY_STORE = 'data'
const HISTORY_KEY = 'transfer_history'
let _historyDbPromise: Promise<IDBDatabase> | null = null
function openHistoryDB(): Promise<IDBDatabase> {
  if (_historyDbPromise) return _historyDbPromise
  _historyDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(HISTORY_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _historyDbPromise
}
function historyIdbGet(): Promise<StoredTask[] | undefined> {
  return openHistoryDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly')
    const req = tx.objectStore(HISTORY_STORE).get(HISTORY_KEY)
    req.onsuccess = () => resolve(req.result as StoredTask[] | undefined)
    req.onerror = () => reject(req.error)
  }))
}
function historyIdbSet(value: StoredTask[]): Promise<void> {
  return openHistoryDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite')
    tx.objectStore(HISTORY_STORE).put(value, HISTORY_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

export function useUploader(
  onDone?: (record?: any) => void,
  onNotify?: (msg: { title: string, color?: string, icon?: string }) => void,
  /** 存储空间不足（413）时触发，name 为被拒绝上传的文件名 */
  onQuotaExceeded?: (name: string) => void
) {
  const { t } = useI18n()
  const { appSettings } = useSettings()
  const tasks = ref<UploadTask[]>([])
  const history = ref<StoredTask[]>([])
  // 异步从 IndexedDB 加载历史（无条数限制）
  loadHistory().then((data) => { history.value = data })
  // 用于上传完成后将文件写入本地缓存（缩略图显示"已缓存"绿点）
  const { cacheFile } = useFileCache()
  const maxConcurrent = 2
  // 任务级 AbortController（暂停/取消）
  const taskControllers = new Map<string, AbortController>()
  // 上传进度节流：xhr.onprogress 可能极高频率，限制 UI 更新节奏
  const progressThrottle = new WeakMap<object, number>()
  const PROGRESS_INTERVAL_MS = 250

  // 上传成功通知防抖聚合：5 秒窗口内只显示一条，成功文件合并为一个消息
  let successToastTimer: ReturnType<typeof setTimeout> | null = null
  const successToastNames: string[] = []
  const SUCCESS_TOAST_WINDOW_MS = 5000
  function notifyUploadSuccess(name: string) {
    successToastNames.push(name)
    if (successToastTimer) clearTimeout(successToastTimer)
    successToastTimer = setTimeout(() => {
      successToastTimer = null
      const names = successToastNames.splice(0)
      if (names.length === 0) return
      if (names.length === 1) {
        onNotify?.({ title: t('app.uploadDone', { name: names[0] }), icon: 'i-lucide-circle-check' })
      } else {
        onNotify?.({
          title: t('app.uploadDoneBatch', { count: names.length, first: names[0] }),
          icon: 'i-lucide-circle-check'
        })
      }
    }, SUCCESS_TOAST_WINDOW_MS)
  }

  /** 从 IndexedDB 加载历史（兼容迁移旧的 localStorage 数据） */
  async function loadHistory(): Promise<StoredTask[]> {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('upload_history')
        if (raw) {
          const legacy = JSON.parse(raw)
          if (Array.isArray(legacy)) {
            localStorage.removeItem('upload_history')
            try { await historyIdbSet(legacy) } catch { /* 忽略 */ }
            return legacy
          }
        }
      }
    } catch {
      // 旧数据损坏时忽略
    }
    try {
      const data = await historyIdbGet()
      if (Array.isArray(data)) return data
    } catch {
      // 读取失败时忽略
    }
    return []
  }

  /** 持久化历史到 IndexedDB（无条数限制） */
  async function saveHistory() {
    try {
      await historyIdbSet(history.value)
    } catch {
      // 写入失败时忽略
    }
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
    // slots 需在循环内递减：否则一次会启动所有 pending，并发失控导致连接拥塞、
    // 表现为「前两个完成、其余卡很久才开始」
    let slots = maxConcurrent - running.length
    for (const t of pending) {
      if (slots <= 0) break
      slots--
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

  /** 小文件直传：一次 POST 上传，返回文件记录 */
  function simpleUpload(task: UploadTask, controller: AbortController): Promise<any> {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('file', task.file, task.file.name)
      form.append('folderId', task.folderId || '')
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload/simple')
      xhr.responseType = 'json'
      const update = (loaded: number) => {
        const now = Date.now()
        const last = progressThrottle.get(task) || 0
        if (now - last < PROGRESS_INTERVAL_MS && loaded < task.file.size) return
        progressThrottle.set(task, now)
        task.uploadedBytes = Math.max(task.uploadedBytes || 0, loaded)
        task.progress = Math.min(99, Math.round((task.uploadedBytes / task.file.size) * 100))
        trackSpeed(task, task.uploadedBytes)
      }
      xhr.upload.onloadstart = () => update(0)
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) update(ev.loaded) }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response)
        } else {
          const msg = (xhr.response as any)?.message || `上传失败: ${xhr.status}`
          const err: any = new Error(msg)
          // 让外层 catch 能识别 413（存储空间不足）
          if (xhr.status === 413) err.data = { statusCode: 413, message: msg }
          reject(err)
        }
      }
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.onabort = () => reject(new Error('aborted'))
      const onAbort = () => xhr.abort()
      controller.signal.addEventListener('abort', onAbort, { once: true })
      xhr.send(form)
    })
  }

  /** 上传成功后的公共处理：进度/状态、本地缓存、历史、toast、回调 */
  async function finishTask(task: UploadTask, uploadRes: any) {
    task.completing = false
    task.progress = 100
    task.status = 'done'
    taskControllers.delete(task.id)
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
    history.value.unshift({
      id: task.id,
      fileName: task.file.name,
      fileSize: task.file.size,
      folderId: task.folderId,
      type: task.type,
      status: 'done',
      time: Date.now()
    })
    saveHistory()
    // 成功 toast 走 5 秒防抖合并，避免批量上传时每个文件弹一条
    notifyUploadSuccess(task.file.name)
    onDone?.(uploadRes)
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
      // 小文件直传：文件大小 <= 用户设置的分片大小（一个分片以内，multipart 无意义）则直传，
      // 一次请求完成，避免多次往返与 complete 合并开销；仅无断点续传会话时走直传
      if (!task.sessionId && task.file.size <= (appSettings.value.uploadChunkSize || 10 * 1024 * 1024)) {
        task.completing = true
        const res = await simpleUpload(task, controller)
        await finishTask(task, res)
        return
      }

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
      }

      // 查询会话状态（partSize + 已完成分片），新会话/断点续传统一处理，仅一次请求
      let doneParts = new Set<number>()
      try {
        const sess = await $fetch<any>(`/api/upload/session/${sessionId}`)
        if (sess.session?.partSize) partSize = sess.session.partSize
        doneParts = new Set((sess.completedParts || []).map((p: any) => p.partNumber))
        // 断点续传：进度恢复到已完成分片
        if (!task.uploadedBytes) {
          task.uploadedBytes = Math.min(doneParts.size * partSize, task.file.size)
          task.progress = Math.min(99, Math.round((task.uploadedBytes / task.file.size) * 100))
        }
      } catch {
        // 查询会话失败时忽略（继续从 0 开始）
      }

      const totalParts = Math.max(1, Math.ceil(task.file.size / partSize))

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
          const now = Date.now()
          const last = progressThrottle.get(task) || 0
          // 未到节流间隔且未完成时跳过（完成时强制更新一次，保证 100% 落库）
          if (now - last < PROGRESS_INTERVAL_MS && totalUploaded < task.file.size) return
          progressThrottle.set(task, now)
          task.uploadedBytes = Math.max(task.uploadedBytes || 0, totalUploaded)
          task.progress = Math.min(99, Math.round((task.uploadedBytes / task.file.size) * 100))
          trackSpeed(task, task.uploadedBytes)
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

      // Step 3: 完成上传（R2 Multipart 合并分片 + 写库），此阶段无进度，标记「正在完成」
      task.completing = true
      const uploadRes = await $fetch<any>('/api/upload/complete', {
        method: 'POST',
        body: { sessionId }
      })
      await finishTask(task, uploadRes)
    } catch (e: any) {
      taskControllers.delete(task.id)
      // 复位「正在完成」标记（complete 阶段失败也要清）
      task.completing = false
      // 被暂停/取消时静默处理
      if (controller.signal.aborted && task.status !== 'done') {
        // 状态已在 togglePause / cancelTask 中设置
        processQueue()
        return
      }
      // 存储空间不足（413）：从传输列表移除、不写入历史，改用模态框提示
      if (e?.data?.statusCode === 413) {
        const idx = tasks.value.findIndex(x => x.id === task.id)
        if (idx !== -1) tasks.value.splice(idx, 1)
        onQuotaExceeded?.(task.file.name)
        processQueue()
        return
      }
      // 优先展示服务端明确错误，否则回退到原始信息
      const serverMsg = e?.data?.message
      const errMsg = serverMsg || e?.message || 'Upload failed'
      // 上传失败：释放 Multipart 会话（中止 R2 分片 + 标记 cancelled），
      // 否则会话会持续占用存储配额，导致可用空间被顶满
      if (task.sessionId) {
        $fetch('/api/upload/abort', { method: 'POST', body: { sessionId: task.sessionId } }).catch(() => {})
        task.sessionId = undefined
      }
      task.status = 'error'
      task.error = errMsg
      history.value.unshift({
        id: task.id,
        fileName: task.file.name,
        fileSize: task.file.size,
        folderId: task.folderId,
        type: task.type,
        status: 'error',
        error: errMsg,
        time: Date.now()
      })
      saveHistory()
      onNotify?.({
        title: serverMsg || t('app.uploadFailed', { name: task.file.name }),
        color: 'error',
        icon: 'i-lucide-circle-x'
      })
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
      onNotify?.({ title: t('app.pausedName', { name: task.file.name }), icon: 'i-lucide-pause' })
      processQueue()
    } else if (task.status === 'paused') {
      task.status = 'uploading'
      onNotify?.({ title: t('app.resumedName', { name: task.file.name }), icon: 'i-lucide-play' })
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
    saveHistory()
    onNotify?.({ title: t('app.cancelledName', { name: task.file.name }), icon: 'i-lucide-x' })
  }

  /** 重试失败的上传任务（重新上传） */
  function retryTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task || task.status !== 'error') return
    // 移除历史里对应的失败记录，避免重试成功后再出现一条
    history.value = history.value.filter(h => h.id !== id)
    saveHistory()
    task.status = 'pending'
    task.progress = 0
    task.uploadedBytes = 0
    task.error = undefined
    task.sessionId = undefined
    processQueue()
  }

  /** 移除已完成/失败的任务 */
  function clearDone() {
    tasks.value = tasks.value.filter(t => t.status === 'pending' || t.status === 'uploading')
  }

  /** 清空历史记录 */
  function clearHistory() {
    history.value = []
    saveHistory()
    onNotify?.({ title: t('app.historyCleared'), icon: 'i-lucide-trash-2' })
  }

  /** 删除单条历史记录 */
  function removeHistory(id: string) {
    const item = history.value.find(h => h.id === id)
    history.value = history.value.filter(h => h.id !== id)
    saveHistory()
    onNotify?.({ title: t('app.deletedName', { name: item?.fileName || t('app.task') }), icon: 'i-lucide-trash-2' })
  }

  return { tasks, history, addFiles, clearDone, clearHistory, removeHistory, togglePause, cancelTask, retryTask, saveHistory }
}
