/**
 * 本地文件索引（IndexedDB 持久化）
 * 首次加载时拉取全部数据 → 构建层级索引 → 存入 IndexedDB
 * 之后文件夹切换全部本地运算，减少数据库延迟
 */
import { toRaw } from 'vue'

export interface IndexItem {
  id: string
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  icon: string
  iconColor: string
  size?: string
  rawSize?: number
  modified?: string
  contentType?: string
  isImage?: boolean
}

const DB_NAME = 'clouddrive-index'
const STORE_NAME = 'data'
// 缓存 key 均按 userId 隔离，避免不同用户看到彼此的文件索引
const LAST_SYNC_LS_PREFIX = 'file_index_last_sync_'
const DB_VERSION = 2

function loadLastSyncLs(key: string): number | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

let _dbPromise: Promise<IDBDatabase> | null = null
let _loading: Promise<void> | null = null

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // 升级时清空旧存储，避免历史损坏数据（如空数组）残留
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      db.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  }))
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

function idbDelete(key: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

// 模块级共享状态：所有调用方（主页面 / 设置页等）共享同一份文件索引。
// 否则 settings 页点「同步索引」只更新自己实例的内存索引 + IndexedDB，
// 主页面内存索引仍是旧的，仍会请求已删除文件的缩略图/预览导致 404。
const items = ref<IndexItem[]>([])
const ready = ref(false)
const loading = ref(false)
const childrenMap = ref<Record<string, IndexItem[]>>({})
const itemMap = ref<Record<string, IndexItem>>({})
// 上次全量同步时间（localStorage 持久化）
const lastSyncAt = ref<number | null>(null)

export function useFileIndex() {
  const { user } = useAuth()
  // 按当前登录用户隔离索引缓存
  const uid = computed(() => user.value?.id || 'anonymous')
  const itemsKey = computed(() => `items:${uid.value}`)
  const syncKey = computed(() => `last_full_sync:${uid.value}`)
  const lastSyncLsKey = computed(() => `${LAST_SYNC_LS_PREFIX}${uid.value}`)

  // 首次调用时按当前用户初始化上次同步时间
  if (lastSyncAt.value === null) {
    lastSyncAt.value = loadLastSyncLs(lastSyncLsKey.value)
  }

  // 用户切换/登录完成后重置本地索引并重新同步
  // （解决 session 异步加载时 onMounted 触发同步失败导致的空索引）
  watch(uid, (newUid, oldUid) => {
    if (oldUid === undefined || oldUid === newUid) return
    items.value = []
    ready.value = false
    childrenMap.value = {}
    itemMap.value = {}
    lastSyncAt.value = loadLastSyncLs(lastSyncLsKey.value)
    loadAll()
  })

  function buildMaps() {
    const cm: Record<string, IndexItem[]> = {}
    const im: Record<string, IndexItem> = {}
    for (const item of items.value) {
      im[item.id] = item
      const key = item.parentId || 'root'
      if (!cm[key]) cm[key] = []
      cm[key].push(item)
    }
    childrenMap.value = cm
    itemMap.value = im
  }

  async function persist() {
    // toRaw 只解除顶层数组，元素仍是 Vue 响应式 Proxy，IndexedDB 无法结构化克隆
    // 用 JSON 序列化彻底剥离 proxy 与特殊类型，保证可克隆
    await idbSet(itemsKey.value, JSON.parse(JSON.stringify(toRaw(items.value))))
  }

  async function loadFromIndexedDB(): Promise<boolean> {
    try {
      const data = await idbGet<IndexItem[]>(itemsKey.value)
      if (Array.isArray(data)) {
        items.value = data
        buildMaps()
        return true
      }
    } catch {
      // IndexedDB 读取失败时视为无本地缓存
    }
    return false
  }

  function toIndexItem(raw: any): IndexItem {
    const isFile = raw.filename !== undefined
    const ext = isFile ? (raw.filename.split('.').pop()?.toLowerCase() || '') : ''
    const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic', 'heif', 'tiff', 'tif', 'raw', 'psd']
    const fileIcon = (name: string): string => {
      const e = name.split('.').pop()?.toLowerCase() || ''
      const MAP: Record<string, string> = {
        'jpg': 'i-lucide-image', 'jpeg': 'i-lucide-image', 'png': 'i-lucide-image', 'gif': 'i-lucide-image', 'webp': 'i-lucide-image', 'svg': 'i-lucide-image', 'bmp': 'i-lucide-image', 'ico': 'i-lucide-image', 'avif': 'i-lucide-image', 'heic': 'i-lucide-image', 'heif': 'i-lucide-image', 'tiff': 'i-lucide-image', 'tif': 'i-lucide-image', 'raw': 'i-lucide-image', 'psd': 'i-lucide-image',
        'mp4': 'i-lucide-film', 'mov': 'i-lucide-film', 'avi': 'i-lucide-film', 'mkv': 'i-lucide-film', 'webm': 'i-lucide-film', 'mp3': 'i-lucide-music', 'wav': 'i-lucide-music', 'flac': 'i-lucide-music', 'aac': 'i-lucide-music', 'ogg': 'i-lucide-music',
        'zip': 'i-lucide-file-archive', 'rar': 'i-lucide-file-archive', '7z': 'i-lucide-file-archive', 'tar': 'i-lucide-file-archive', 'gz': 'i-lucide-file-archive',
        'pdf': 'i-lucide-file-text', 'doc': 'i-lucide-file-type', 'docx': 'i-lucide-file-type', 'txt': 'i-lucide-file-text', 'md': 'i-lucide-file-text',
        'xls': 'i-lucide-file-spreadsheet', 'xlsx': 'i-lucide-file-spreadsheet', 'csv': 'i-lucide-file-spreadsheet',
        'ppt': 'i-lucide-presentation', 'pptx': 'i-lucide-presentation',
        'js': 'i-lucide-file-code', 'ts': 'i-lucide-file-code', 'py': 'i-lucide-file-code', 'html': 'i-lucide-file-code', 'css': 'i-lucide-file-code', 'json': 'i-lucide-file-code',
        'exe': 'i-lucide-package', 'apk': 'i-lucide-package', 'dmg': 'i-lucide-package',
        'ttf': 'i-lucide-type', 'otf': 'i-lucide-type', 'woff': 'i-lucide-type',
        'db': 'i-lucide-database', 'sqlite': 'i-lucide-database'
      }
      return MAP[e] || 'i-lucide-file'
    }
    const formatSize = (bytes?: number): string => {
      if (!bytes) return ''
      const u = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
    }
    return {
      id: raw.id,
      name: isFile ? raw.filename : raw.name,
      type: isFile ? 'file' : 'folder',
      parentId: isFile ? raw.folderId : (raw.parentId ?? null),
      icon: isFile ? fileIcon(raw.filename) : 'fluent-emoji:file-folder',
      iconColor: isFile ? 'text-gray-400' : 'text-amber-500',
      size: isFile ? formatSize(raw.size) : undefined,
      rawSize: isFile ? raw.size : undefined,
      modified: raw.updatedAt || raw.createdAt,
      contentType: isFile ? (raw.contentType || '') : undefined,
      isImage: isFile && IMAGE_EXTS.includes(ext)
    }
  }

  /** 今天是否已经全量同步过 */
  async function hasSyncedToday(): Promise<boolean> {
    try {
      const ts = await idbGet<number>(syncKey.value)
      if (!ts) return false
      const d = new Date(ts)
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    } catch { return false }
  }

  async function loadAll() {
    if (ready.value) return
    if (_loading) return _loading
    // 每日第一次加载才做全量同步；否则直接用本地 IndexedDB
    if (await hasSyncedToday() && await loadFromIndexedDB()) {
      ready.value = true
      return
    }
    return fullSync()
  }

  /** 全量同步：从服务器拉取全部数据覆盖本地索引（每日首次或手动触发） */
  async function fullSync() {
    if (_loading) return _loading
    _loading = (async () => {
      loading.value = true
      try {
        const res = await $fetch<any>('/api/all')
        if (!Array.isArray(res?.folders) || !Array.isArray(res?.files)) {
          throw new Error('全量同步接口返回格式异常')
        }
        items.value = [
          ...(res.folders || []).map(toIndexItem),
          ...(res.files || []).map(toIndexItem)
        ]
        buildMaps()
        await persist()
        const ts = Date.now()
        await idbSet(syncKey.value, ts)
        // 持久化到 localStorage 供设置页展示
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem(lastSyncLsKey.value, String(ts))
        } catch {
          // 存储失败时静默忽略
        }
        lastSyncAt.value = ts
        ready.value = true
      } finally {
        loading.value = false
        _loading = null
      }
    })()
    return _loading
  }

  /** 数据变动后的本地增量同步：只把对应记录插入/更新到本地 DB */
  function syncItem(raw: any) {
    return upsertItem(raw)
  }

  function getChildren(parentId: string | null): IndexItem[] {
    return childrenMap.value[parentId || 'root'] || []
  }

  function getItem(id: string): IndexItem | undefined {
    return itemMap.value[id]
  }

  function addItem(raw: any) {
    const item = toIndexItem(raw)
    items.value.push(item)
    buildMaps()
    persist()
    return item
  }

  function upsertItem(raw: any) {
    const idx = items.value.findIndex(i => i.id === raw.id)
    const item = toIndexItem(raw)
    if (idx >= 0) items.value[idx] = item
    else items.value.push(item)
    buildMaps()
    persist()
    return item
  }

  function removeItem(id: string) {
    items.value = items.value.filter(i => i.id !== id)
    buildMaps()
    persist()
  }

  /** 递归移除文件夹及其全部后代（文件 + 子文件夹），并持久化（返回 Promise 供 await） */
  function removeItemsDeep(id: string) {
    const ids = new Set<string>()
    const queue = [id]
    while (queue.length) {
      const cur = queue.shift()!
      if (ids.has(cur)) continue
      ids.add(cur)
      for (const child of items.value.filter(i => i.parentId === cur)) queue.push(child.id)
    }
    items.value = items.value.filter(i => !ids.has(i.id))
    buildMaps()
    return persist()
  }

  /** 清空本地索引缓存（IndexedDB + localStorage + 内存），下次加载将重新以服务端为准全量同步 */
  async function clearIndexCache() {
    try {
      await idbDelete(itemsKey.value)
      await idbDelete(syncKey.value)
    } catch {
      // 删除失败忽略，随后 persist 空数组覆盖
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(lastSyncLsKey.value)
      } catch {
        // 忽略
      }
    }
    items.value = []
    ready.value = false
    childrenMap.value = {}
    itemMap.value = {}
    lastSyncAt.value = null
    await persist()
  }

  return { items, ready, loading, lastSyncAt, loadAll, fullSync, syncItem, getChildren, getItem, upsertItem, addItem, removeItem, removeItemsDeep, clearIndexCache }
}
