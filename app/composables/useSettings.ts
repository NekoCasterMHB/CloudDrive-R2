/**
 * 应用设置（D1 持久化 + localStorage 兜底）
 *
 * 设置页的所有可配置项统一存到 D1（user_settings 表），跨设备同步；
 * localStorage 作为即时兜底（页面加载立即可用，避免异步空白），
 * 加载到 D1 数据后覆盖本地值。
 */
import { ref } from 'vue'

export interface AppSettings {
  /** 上传分片大小（字节），服务端 upload/init 读取 */
  uploadChunkSize: number
  /** 预览缓存开关 */
  cacheEnabled: boolean
  /** 预览缓存最大容量（字节），0 表示无限制 */
  cacheMaxSize: number
  /** 预览缓存文件类型（image / video / audio ...） */
  cacheTypes: string[]
  /** 云盘存储上限（字节） */
  storageLimit: number
  /** 并发传输数（默认 3，范围 1-5） */
  concurrentDownloads: number
}

const DEFAULTS: AppSettings = {
  uploadChunkSize: 10 * 1024 * 1024,
  cacheEnabled: true,
  cacheMaxSize: 1024 * 1024 * 1024,
  cacheTypes: ['image', 'video', 'audio'],
  storageLimit: 1024 * 1024 * 1024 * 1024, // 1 TB
  concurrentDownloads: 3
}

const LS_KEY = 'clouddrive_settings'

function loadLocal(): AppSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw)
    return {
      uploadChunkSize: typeof p.uploadChunkSize === 'number' && p.uploadChunkSize > 0 ? p.uploadChunkSize : DEFAULTS.uploadChunkSize,
      cacheEnabled: typeof p.cacheEnabled === 'boolean' ? p.cacheEnabled : DEFAULTS.cacheEnabled,
      cacheMaxSize: typeof p.cacheMaxSize === 'number' && p.cacheMaxSize >= 0 ? p.cacheMaxSize : DEFAULTS.cacheMaxSize,
      cacheTypes: Array.isArray(p.cacheTypes) && p.cacheTypes.length
        ? p.cacheTypes.filter((x: unknown) => typeof x === 'string')
        : [...DEFAULTS.cacheTypes],
      storageLimit: typeof p.storageLimit === 'number' && p.storageLimit > 0 ? p.storageLimit : DEFAULTS.storageLimit,
      concurrentDownloads: typeof p.concurrentDownloads === 'number' && p.concurrentDownloads >= 1 && p.concurrentDownloads <= 5
        ? Math.round(p.concurrentDownloads)
        : DEFAULTS.concurrentDownloads
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveLocal(s: AppSettings) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    // 存储失败（如隐私模式）时静默忽略
  }
}

// 模块级单例（SPA 全程存活，需在用户切换时重置，否则会残留上一个账号的组/设置）
const settings = ref<AppSettings>(loadLocal())
const loaded = ref(false)
// 用户组统一管理：被锁定不可手动修改的设置项 / 可否改密码 / 所属组名
const managed = ref<string[]>([])
const canChangePassword = ref(true)
const groupName = ref<string | null>(null)

/** 从 D1 拉取设置并覆盖本地（已加载过则跳过） */
async function load() {
  if (loaded.value) return
  try {
    const res = await $fetch<Partial<AppSettings> & { managed?: string[], canChangePassword?: boolean, groupName?: string | null }>('/api/settings')
    settings.value = { ...DEFAULTS, ...settings.value, ...res }
    managed.value = Array.isArray(res?.managed) ? res.managed : []
    canChangePassword.value = res?.canChangePassword !== false
    groupName.value = res?.groupName ?? null
    loaded.value = true
    saveLocal(settings.value)
  } catch {
    // 拉取失败时使用本地兜底值
  }
}

/** 乐观更新并持久化到 D1（localStorage 同步缓存） */
async function save(patch: Partial<AppSettings>) {
  settings.value = { ...settings.value, ...patch }
  saveLocal(settings.value)
  try {
    await $fetch('/api/settings', { method: 'PUT', body: patch })
  } catch {
    // 保存失败时保留本地值，下次再同步
  }
}

export function useSettings() {
  return { settings, loaded, load, save, managed, canChangePassword, groupName }
}

// 模块加载时注册一次：当前用户变化（登出 / 切换账号）时重置单例并重新拉取，
// 避免上一个账号的「所属用户组」/ 锁定项 / 设置残留到新账号
{
  const { user } = useAuth()
  let lastUserId: string | null = null
  watch(() => user.value?.id, (id) => {
    if (id && id !== lastUserId) {
      lastUserId = id
      loaded.value = false
      managed.value = []
      canChangePassword.value = true
      groupName.value = null
      settings.value = loadLocal()
      load()
    }
  })
}
