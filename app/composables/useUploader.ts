/**
 * 文件上传 composable
 * 支持小文件直传 / 大文件分片上传
 */

export interface UploadTask {
  id: string
  file: File
  folderId: string | null
  type: 'upload' | 'download'
  status: 'pending' | 'uploading' | 'done' | 'error' | 'paused' | 'cancelled'
  progress: number
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

const DEMO_HISTORY: StoredTask[] = [
  { id: 'demo-img', fileName: 'vacation-photo.jpg', fileSize: 5242880, folderId: null, type: 'upload', status: 'done', time: Date.now() - 60000 },
  { id: 'demo-vid', fileName: 'movie-trailer.mp4', fileSize: 524288000, folderId: null, type: 'upload', status: 'done', time: Date.now() - 90000 },
  { id: 'demo-audio', fileName: 'song.mp3', fileSize: 10485760, folderId: null, type: 'download', status: 'done', time: Date.now() - 120000 },
  { id: 'demo-archive', fileName: 'backup.zip', fileSize: 1073741824, folderId: null, type: 'upload', status: 'done', time: Date.now() - 180000 },
  { id: 'demo-pdf', fileName: 'report.pdf', fileSize: 2097152, folderId: null, type: 'download', status: 'done', time: Date.now() - 240000 },
  { id: 'demo-xls', fileName: 'data.xlsx', fileSize: 512000, folderId: null, type: 'upload', status: 'done', time: Date.now() - 300000 },
  { id: 'demo-ppt', fileName: 'slides.pptx', fileSize: 8192000, folderId: null, type: 'download', status: 'done', time: Date.now() - 360000 },
  { id: 'demo-code', fileName: 'app.ts', fileSize: 10240, folderId: null, type: 'upload', status: 'done', time: Date.now() - 420000 },
  { id: 'demo-exe', fileName: 'installer.exe', fileSize: 73400320, folderId: null, type: 'download', status: 'done', time: Date.now() - 480000 },
  { id: 'demo-font', fileName: 'Inter.ttf', fileSize: 262144, folderId: null, type: 'upload', status: 'done', time: Date.now() - 540000 },
  { id: 'demo-cad', fileName: 'model.stl', fileSize: 15728640, folderId: null, type: 'download', status: 'done', time: Date.now() - 600000 },
  { id: 'demo-db', fileName: 'users.sqlite', fileSize: 1048576, folderId: null, type: 'upload', status: 'done', time: Date.now() - 660000 },
  { id: 'demo-txt', fileName: 'notes.txt', fileSize: 5120, folderId: null, type: 'upload', status: 'cancelled', time: Date.now() - 720000 },
  { id: 'demo-paused', fileName: 'large-video.mkv', fileSize: 4294967296, folderId: null, type: 'download', status: 'done', time: Date.now() - 780000 },
]

let _demoSeeded = false

export function useUploader(onDone?: () => void, onNotify?: (msg: { title: string; color?: string; icon?: string }) => void) {
  const tasks = ref<UploadTask[]>([])
  const history = ref<StoredTask[]>(loadHistory())
  const maxConcurrent = 2

  // Seed demo active tasks (only once, module-level singleton)
  if (!_demoSeeded) {
    _demoSeeded = true
    tasks.value.push(
      { id: 'demo-up', file: new File([], 'backup-2025.tar.gz'), folderId: null, type: 'upload', status: 'uploading', progress: 45.67 },
      { id: 'demo-dl', file: new File([], 'movie-clip.mp4'), folderId: null, type: 'download', status: 'uploading', progress: 72.31 },
    )
    const timer = setInterval(() => {
      for (const t of tasks.value) {
        if (t.status === 'uploading' && t.progress < 95) t.progress = Math.round((t.progress + Math.random() * 3) * 100) / 100
      }
    }, 1000)
    try { window.addEventListener('beforeunload', () => clearInterval(timer)) } catch {}
  }

  function loadHistory(): StoredTask[] {
    let items: StoredTask[] = []
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('upload_history')
        if (raw) items = JSON.parse(raw)
      }
    }
    catch {}
    // Always prepend demo data at the front
    return [...DEMO_HISTORY, ...items]
  }

  function saveHistory() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem('upload_history', JSON.stringify(history.value.slice(0, 100)))
  }

  /** 获取分片大小设置 (bytes) */
  function getChunkSize(): number {
    if (typeof localStorage === 'undefined') return 10 * 1024 * 1024
    const val = localStorage.getItem('upload_chunk_size')
    return val ? parseInt(val) : 10 * 1024 * 1024
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
        progress: 0,
      })
    }
    processQueue()
  }

  /** 处理上传队列 */
  async function processQueue() {
    const pending = tasks.value.filter(t => t.status === 'pending')
    const running = tasks.value.filter(t => t.status === 'uploading')
    const slots = maxConcurrent - running.length
    for (let i = 0; i < Math.min(slots, pending.length); i++) {
      uploadFile(pending[i])
    }
  }

  /** 上传单个文件 */
  async function uploadFile(task: UploadTask) {
    task.status = 'uploading'
    const chunkSize = getChunkSize()

    try {
      if (task.file.size <= chunkSize) {
        // 小文件直传
        const form = new FormData()
        form.append('file', task.file)
        if (task.folderId) form.append('folderId', task.folderId)

        await $fetch('/api/upload', { method: 'POST', body: form })
        task.progress = 100
      }
      else {
        // 大文件分片上传
        const totalChunks = Math.ceil(task.file.size / chunkSize)
        let uploadId: string | null = null

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize
          const end = Math.min(start + chunkSize, task.file.size)
          const chunk = task.file.slice(start, end, task.file.type)

          const form = new FormData()
          form.append('file', chunk, task.file.name)
          if (task.folderId) form.append('folderId', task.folderId)

          const res = await $fetch<any>('/api/upload', {
            method: 'POST',
            body: form,
            headers: {
              'x-chunk-index': String(i),
              'x-chunk-total': String(totalChunks),
              ...(uploadId ? { 'x-upload-id': uploadId } : {}),
            },
          })

          if (res.uploadId) uploadId = res.uploadId
          task.progress = Math.round(((i + 1) / totalChunks) * 100)
        }
      }

      task.status = 'done'
      history.value.unshift({
        id: task.id,
        fileName: task.file.name,
        fileSize: task.file.size,
        folderId: task.folderId,
        type: task.type,
        status: 'done',
        time: Date.now(),
      })
      if (history.value.length > 100) history.value.pop()
      saveHistory()
      onNotify?.({ title: `${task.file.name} 上传完成`, icon: 'i-lucide-circle-check' })
      onDone?.()
    }
    catch (e: any) {
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
        time: Date.now(),
      })
      if (history.value.length > 100) history.value.pop()
      saveHistory()
      onNotify?.({ title: `${task.file.name} 上传失败`, color: 'error', icon: 'i-lucide-circle-x' })
    }

    // 继续处理队列
    processQueue()
  }

  /** 暂停/继续任务 */
  function togglePause(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    if (task.status === 'uploading') {
      task.status = 'paused'
      onNotify?.({ title: `${task.file.name} 已暂停`, icon: 'i-lucide-pause' })
    }
    else if (task.status === 'paused') {
      task.status = 'uploading'
      onNotify?.({ title: `${task.file.name} 已继续`, icon: 'i-lucide-play' })
      processQueue()
    }
  }

  /** 取消任务 */
  function cancelTask(id: string) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const task = tasks.value[idx]
    tasks.value.splice(idx, 1)
    history.value.unshift({
      id: task.id,
      fileName: task.file.name,
      fileSize: task.file.size,
      folderId: task.folderId,
      type: task.type,
      status: 'cancelled',
      time: Date.now(),
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
