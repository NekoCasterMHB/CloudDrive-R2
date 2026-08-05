/**
 * 文件预览缓存（IndexedDB 实现）
 *
 * 预览过的文件（图片/视频/音频等，可在设置页配置缓存类型）会存入本地 IndexedDB，
 * 再次预览时直接从本地加载，节约流量、加快加载速度。
 *
 * 特性：
 * - 设置项（启用开关 / 最大容量 / 缓存类型）持久化到 localStorage，设置页可修改
 * - 达到最大容量后按最近最少使用（LRU）自动清理最旧的文件
 * - 模块级共享状态：设置页与主页面读写同一份配置
 */
import { readonly } from 'vue'
import { useSettings } from './useSettings'
import type { AppSettings } from './useSettings'

export interface CacheSettings {
  enabled: boolean
  maxSize: number
  types: string[]
}

export interface CacheEntry {
  id: string
  name: string
  contentType: string
  size: number
  blob: Blob
  cachedAt: number
  lastAccessAt: number
}

/** 视频封面帧缓存条目：dataURL 字符串，体积远小于原视频 */
export interface ThumbEntry {
  id: string
  dataUrl: string
  cachedAt: number
}

const DB_NAME = 'clouddrive-cache'
const STORE = 'files'
const THUMB_STORE = 'thumbnails'
const DB_VERSION = 2

export const DEFAULT_MAX_SIZE = 1024 * 1024 * 1024 // 1GB

let _dbPromise: Promise<IDBDatabase> | null = null
let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        db.createObjectStore(THUMB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => {
      _db = req.result
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB 被其他标签页占用'))
  })
  // 打开失败时不缓存失败的 Promise，允许后续重试
  _dbPromise.catch(() => {
    _dbPromise = null
  })
  return _dbPromise
}

/**
 * 作废当前连接并关闭，下次操作自动重开新连接。
 * 自愈：清空缓存 / 外部删除数据库 / 连接损坏后，缓存读写能自动恢复，不再永久失效。
 */
function invalidateDB() {
  try {
    _db?.close()
  } catch {
    // 忽略关闭失败
  }
  _db = null
  _dbPromise = null
}
// ---------- 设置（D1 持久化，localStorage 兜底，见 useSettings） ----------
const { settings: appSettings, save: saveAppSettings } = useSettings()

// 缓存设置 = useSettings 的子集（enabled/maxSize/types）
const settings = computed<CacheSettings>(() => ({
  enabled: appSettings.value.cacheEnabled,
  maxSize: appSettings.value.cacheMaxSize,
  types: appSettings.value.cacheTypes
}))

/**
 * 判断 contentType 是否属于可缓存类型
 * types 为媒体大类（image / video / audio ...），按前缀匹配，如 "image" 匹配 "image/jpeg"
 */
export function shouldCacheContentType(contentType: string, cache?: CacheSettings): boolean {
  const s = cache || {
    enabled: appSettings.value.cacheEnabled,
    maxSize: appSettings.value.cacheMaxSize,
    types: appSettings.value.cacheTypes
  }
  if (!s.enabled) return false
  const ct = (contentType || '').toLowerCase()
  if (!ct) return false
  return s.types.some((t) => {
    const type = t.toLowerCase().trim()
    return ct === type || ct.startsWith(type + '/')
  })
}

const EXT_MEDIA: Record<string, string> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image', avif: 'image', heic: 'image', heif: 'image', tiff: 'image', tif: 'image',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio', m4a: 'audio'
}

/** 按文件名扩展名推断媒体大类并判断是否可缓存（contentType 缺失/为 octet-stream 时兜底） */
export function shouldCacheByExt(name: string, cache?: CacheSettings): boolean {
  const s = cache || {
    enabled: appSettings.value.cacheEnabled,
    maxSize: appSettings.value.cacheMaxSize,
    types: appSettings.value.cacheTypes
  }
  if (!s.enabled) return false
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  const media = EXT_MEDIA[ext]
  if (!media) return false
  return s.types.some(t => t.toLowerCase().trim() === media)
}

// ---------- IndexedDB 基础操作（全部容错：永不 reject，失败时作废连接并返回安全默认值） ----------
function idbPut(entry: CacheEntry): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
  })
}

function idbGet(id: string): Promise<CacheEntry | undefined> {
  return openDB().then(db => new Promise<CacheEntry | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as CacheEntry | undefined)
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
    return undefined
  })
}

function idbDelete(id: string): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
  })
}

function idbClear(): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
  })
}

function getAllEntries(): Promise<CacheEntry[]> {
  return openDB().then(db => new Promise<CacheEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result || []) as CacheEntry[])
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
    return []
  })
}

// ---------- 视频封面帧缓存（缩略图，dataURL 持久化到 IndexedDB） ----------
const THUMB_MAX = 300 // 缩略图缓存上限条数，超出按最旧清理

function idbThumbGet(id: string): Promise<ThumbEntry | undefined> {
  return openDB().then(db => new Promise<ThumbEntry | undefined>((resolve, reject) => {
    const tx = db.transaction(THUMB_STORE, 'readonly')
    const req = tx.objectStore(THUMB_STORE).get(id)
    req.onsuccess = () => resolve(req.result as ThumbEntry | undefined)
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
    return undefined
  })
}

function idbThumbPut(entry: ThumbEntry): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(THUMB_STORE, 'readwrite')
    tx.objectStore(THUMB_STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
  })
}

function idbThumbDelete(id: string): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(THUMB_STORE, 'readwrite')
    tx.objectStore(THUMB_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
  })
}

function idbThumbGetAll(): Promise<ThumbEntry[]> {
  return openDB().then(db => new Promise<ThumbEntry[]>((resolve, reject) => {
    const tx = db.transaction(THUMB_STORE, 'readonly')
    const req = tx.objectStore(THUMB_STORE).getAll()
    req.onsuccess = () => resolve((req.result || []) as ThumbEntry[])
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
    return []
  })
}

function idbThumbClear(): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(THUMB_STORE, 'readwrite')
    tx.objectStore(THUMB_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })).catch(() => {
    invalidateDB()
  })
}

/** 缩略图条目数超过上限时按最旧（cachedAt）清理 */
async function evictThumbsIfNeeded() {
  try {
    const all = await idbThumbGetAll()
    if (all.length <= THUMB_MAX) return
    all.sort((a, b) => a.cachedAt - b.cachedAt)
    const overflow = all.length - THUMB_MAX
    for (let i = 0; i < overflow; i++) {
      await idbThumbDelete(all[i].id)
    }
  } catch {
    // 清理失败静默忽略
  }
}

// ---------- 模块级共享状态 ----------
const stats = ref<{ count: number, size: number }>({ count: 0, size: 0 })

export function useFileCache() {
  async function refreshStats() {
    const entries = await getAllEntries().catch(() => [])
    stats.value = entries.reduce(
      (acc, e) => ({ count: acc.count + 1, size: acc.size + (e.size || 0) }),
      { count: 0, size: 0 }
    )
  }

  function updateSettings(next: Partial<CacheSettings>) {
    // 映射到 AppSettings 并持久化到 D1（useSettings 内乐观更新 + localStorage 兜底）
    const patch: Partial<AppSettings> = {}
    if (next.enabled !== undefined) patch.cacheEnabled = next.enabled
    if (next.maxSize !== undefined) patch.cacheMaxSize = next.maxSize
    if (next.types !== undefined) patch.cacheTypes = next.types
    saveAppSettings(patch)
    // 缩小最大容量时立即按新限制清理
    if (next.maxSize !== undefined) evictIfNeeded()
  }

  /** 读取缓存条目（同时刷新访问时间，用于 LRU）。失败时返回 undefined，不抛出 */
  async function getEntry(id: string): Promise<CacheEntry | undefined> {
    const entry = await idbGet(id)
    if (entry) {
      entry.lastAccessAt = Date.now()
      await idbPut(entry)
    }
    return entry
  }

  async function has(id: string): Promise<boolean> {
    return !!(await idbGet(id))
  }

  /** 写入缓存；不符合类型或超过容量则跳过。返回是否写入成功 */
  async function cacheFile(input: { id: string, name: string, contentType: string, blob: Blob }): Promise<boolean> {
    try {
      // contentType 与扩展名任一匹配即缓存（jpg 等即使 contentType 被记为 octet-stream 也能缓存）
      if (!shouldCacheContentType(input.contentType, settings.value) && !shouldCacheByExt(input.name, settings.value)) return false
      if (input.blob.size <= 0) return false
      // maxSize=0 表示无限制，不检查容量
      if (settings.value.maxSize > 0 && input.blob.size > settings.value.maxSize) return false
      const entry: CacheEntry = {
        id: input.id,
        name: input.name,
        contentType: input.contentType,
        size: input.blob.size,
        blob: input.blob,
        cachedAt: Date.now(),
        lastAccessAt: Date.now()
      }
      await idbPut(entry)
      await evictIfNeeded()
      refreshStats()
      return true
    } catch {
      return false
    }
  }

  /** 若已缓存则返回对象 URL（调用方负责 revoke），否则返回 null。失败时返回 null */
  async function getObjectUrl(id: string): Promise<string | null> {
    try {
      const entry = await getEntry(id)
      return entry ? URL.createObjectURL(entry.blob) : null
    } catch {
      return null
    }
  }

  /** 超过最大容量时按最近最少使用（LRU）删除最旧条目 */
  async function evictIfNeeded() {
    try {
      const max = settings.value.maxSize
      // 无限制（maxSize <= 0）时无需逐出
      if (max <= 0) return
      const entries = await getAllEntries()
      let total = entries.reduce((s, e) => s + (e.size || 0), 0)
      if (total <= max) return
      entries.sort((a, b) => a.lastAccessAt - b.lastAccessAt) // 最旧在前
      for (const e of entries) {
        if (total <= max) break
        await idbDelete(e.id)
        total -= e.size || 0
      }
      refreshStats()
    } catch {
      // 缓存清理失败时静默忽略，不影响主流程
    }
  }

  async function clearCache() {
    await idbClear()
    await idbThumbClear()
    // 清空后作废连接，下次操作重开新连接，避免缓存功能"失效"
    invalidateDB()
    refreshStats()
  }

  async function removeEntry(id: string) {
    await idbDelete(id).catch(() => {})
    refreshStats()
  }

  /** 读取已缓存的视频封面帧（dataURL）；未命中/失败返回 null */
  async function getThumbnail(id: string): Promise<string | null> {
    try {
      const entry = await idbThumbGet(id)
      if (!entry) return null
      // 刷新访问时间，供 LRU 清理使用
      entry.cachedAt = Date.now()
      await idbThumbPut(entry)
      return entry.dataUrl
    } catch {
      return null
    }
  }

  /** 缓存视频封面帧（dataURL）。配额不足时先清理最旧一批再重试。返回是否成功 */
  async function setThumbnail(id: string, dataUrl: string): Promise<boolean> {
    try {
      await idbThumbPut({ id, dataUrl, cachedAt: Date.now() })
      await evictThumbsIfNeeded()
      return true
    } catch {
      // 写入失败（如配额超限）：清掉最旧的 1/4 再试一次
      try {
        const all = await idbThumbGetAll()
        all.sort((a, b) => a.cachedAt - b.cachedAt)
        const drop = Math.max(1, Math.floor(all.length / 4))
        for (let i = 0; i < drop; i++) await idbThumbDelete(all[i].id)
        await idbThumbPut({ id, dataUrl, cachedAt: Date.now() })
        return true
      } catch {
        return false
      }
    }
  }

  /** 删除某文件的封面帧缓存（回收站/删除时调用） */
  async function removeThumbnail(id: string) {
    await idbThumbDelete(id).catch(() => {})
  }

  /**
   * 预览加载辅助：命中缓存 → 返回本地对象 URL；
   * 未命中且类型可缓存 → 下载并写入缓存后返回对象 URL；
   * 不可缓存 → 返回 API URL（由浏览器/Service Worker 缓存兜底）
   */
  async function loadPreview(opts: { id: string, name: string, contentType?: string, apiUrl: string }): Promise<string> {
    const cachedUrl = await getObjectUrl(opts.id)
    if (cachedUrl) return cachedUrl
    const ct = opts.contentType || ''
    if (ct && !shouldCacheContentType(ct, settings.value)) return opts.apiUrl
    try {
      const res = await $fetch<Blob>(opts.apiUrl, { responseType: 'blob' })
      const blob = res instanceof Blob ? res : new Blob([res], { type: ct || '' })
      const finalCt = blob.type || ct
      await cacheFile({ id: opts.id, name: opts.name, contentType: finalCt, blob })
      return URL.createObjectURL(blob)
    } catch {
      return opts.apiUrl
    }
  }

  return {
    settings: readonly(settings),
    stats: readonly(stats),
    updateSettings,
    getEntry,
    has,
    cacheFile,
    getObjectUrl,
    clearCache,
    removeEntry,
    getThumbnail,
    setThumbnail,
    removeThumbnail,
    refreshStats,
    loadPreview,
    shouldCache: (ct: string) => shouldCacheContentType(ct, settings.value)
  }
}
