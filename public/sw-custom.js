/**
 * Web Share Target 拦截（经 nuxt.config.ts pwa.workbox.importScripts 合入 sw.js）
 *
 * Android 安装 PWA 后，相册/文件管理器分享面板会出现本应用；分享的文件以
 * multipart/form-data POST 到 /share-target。本脚本在 workbox 路由之前注册
 * fetch 监听拦截该请求：取出文件暂存 IndexedDB，303 重定向回 /?share-target=1，
 * 页面加载后向 SW 请求暂存文件并入上传队列（见 useUploader 消费逻辑）。
 *
 * 注意：Cache API 只接受 GET 请求（无法 put POST），File 对象可结构化克隆，
 * 故走 IndexedDB 暂存——这是 web.dev 官方推荐方案。
 */

const SHARED_DB = 'clouddrive-shared-files'
const SHARED_STORE = 'files'

function openSharedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARED_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (db.objectStoreNames.contains(SHARED_STORE)) db.deleteObjectStore(SHARED_STORE)
      db.createObjectStore(SHARED_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function stashSharedFiles(files) {
  const db = await openSharedDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARED_STORE, 'readwrite')
    tx.objectStore(SHARED_STORE).clear()
    files.forEach((f, i) => tx.objectStore(SHARED_STORE).put({ id: 'shared-' + i, file: f }))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function takeSharedFiles() {
  const db = await openSharedDB()
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARED_STORE, 'readonly')
    const req = tx.objectStore(SHARED_STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  // 一次性取走后清空，避免重复消费
  await new Promise((resolve) => {
    const tx = db.transaction(SHARED_STORE, 'readwrite')
    tx.objectStore(SHARED_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  return rows.map(r => r.file)
}

async function handleShareTarget(event) {
  const toApp = path => Response.redirect(new URL(path, self.registration.scope).toString(), 303)
  try {
    const form = await event.request.formData()
    const entries = (form.getAll('files') || []).filter(v => typeof v === 'object' && v !== null)
    if (entries.length) {
      await stashSharedFiles(entries)
      return toApp('/?share-target=1')
    }
    // 只有文本/链接的分享（无文件）：带参数进应用，由页面自行决定用途
    const text = (form.get('text') || form.get('url') || '').toString()
    return toApp('/?share-target=1' + (text ? '&shared-text=' + encodeURIComponent(text) : ''))
  } catch {
    return toApp('/?share-target=1')
  }
}

self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url)
    if (event.request.method === 'POST' && url.pathname === '/share-target') {
      event.respondWith(handleShareTarget(event))
    }
  } catch {
    // URL 解析失败时放行，交给 workbox/服务端兜底
  }
})

// 页面请求暂存的分享文件（一次性取走）
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'get-shared-files') {
    // 注意：Client.postMessage 的第二个参数是 transfer list（不是 targetOrigin），
    // 传 origin 字符串会抛 TypeError 导致回复丢失
    const reply = (files) => {
      if (event.source) event.source.postMessage({ action: 'shared-files', files })
    }
    takeSharedFiles()
      .then(reply)
      .catch(() => reply([]))
  }
})
