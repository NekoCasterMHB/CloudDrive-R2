/**
 * 打包下载 composable（流式方案）
 *
 * 主路径（Chromium）：File System Access API
 *   showSaveFilePicker 让用户选保存位置 → fflate 流式压缩 → FileSystemWritableFileStream 直写用户磁盘
 * 兜底（Safari/Firefox）：OPFS 暂存
 *   fflate 流式压缩 → OPFS 沙盒文件；完成后由页面提供「保存到本地」按钮导出
 *
 * 两种路径都只让单个文件的数据在内存中短暂流过（fetch → 压缩 → 磁盘），
 * 不会像旧版 JSZip 那样把所有文件整体驻留内存。
 */
import { AsyncZipDeflate, Zip } from 'fflate'

export interface ZipEntry {
  id: string
  /** zip 内相对路径（含子目录，如 `folder/sub/a.txt`） */
  name: string
  /** 文件字节数 */
  size: number
}

export interface ZipProgress {
  doneBytes: number
  totalBytes: number
  /** 0-based 当前文件序号 */
  fileIndex: number
  totalFiles: number
  currentFile: string
  /** 当前文件已完成字节数 */
  fileDoneBytes: number
  /** 当前文件总字节数 */
  fileSize: number
}

/** 统一的目标写入接口（FSA / OPFS 的 FileSystemWritableFileStream 适配） */
export interface ZipTarget {
  write(data: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(reason?: any): Promise<void>
}

/** 支持按位置写入的目标（用于大文件 Range 分块并发下载） */
export interface PositionalZipTarget {
  writeAt(data: Uint8Array, position: number): Promise<void>
  close(): Promise<void>
  abort(reason?: any): Promise<void>
}

export const supportSaveFilePicker = () =>
  typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function'

export const supportOPFS = () =>
  typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory

/** 递归收集所有文件条目（相对路径 + 字节数），文件夹用 getChildren 展开 */
export function collectZipEntries(
  roots: { id: string, name: string, type: 'file' | 'folder' }[],
  getChildren: (folderId: string | null) => any[]
): ZipEntry[] {
  const out: ZipEntry[] = []
  const walk = (list: any[], prefix: string) => {
    for (const item of list) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name
      if (item.type === 'folder') {
        walk(getChildren(item.id) || [], rel)
      } else {
        // 兼容主界面索引(rawSize) 与分享页索引(size) 的文件字节数字段
        const s = typeof item.rawSize === 'number' ? item.rawSize : (typeof item.size === 'number' ? item.size : 0)
        out.push({ id: item.id, name: rel, size: s })
      }
    }
  }
  walk(roots, '')
  return out
}

/**
 * 把 entries 流式压缩为 zip，并把压缩输出写入 target。
 * 压缩在 Worker 中进行（AsyncZipDeflate）；文件按 concurrency 并发拉取，
 * fflate 的 Zip 按 add 顺序组织归档、内部按序缓冲刷出，因此并发安全。
 * fetch 输入与磁盘输出都有背压控制，内存占用约等于并发文件数。
 * @param getFileUrl 文件下载 URL 构建函数（分享页传 /api/share/:token/download?fileId=）
 * @param concurrency 并发文件数（默认 3）
 */
export function streamZipToTarget(
  entries: ZipEntry[],
  target: ZipTarget,
  onProgress: (p: ZipProgress) => void,
  signal?: AbortSignal,
  getFileUrl: (id: string) => string = (id) => `/api/files/${id}/download`,
  concurrency = 3
): Promise<void> {
  const totalBytes = entries.reduce((s, e) => s + e.size, 0)
  const totalFiles = entries.length
  const MAX_PENDING = 32 // 输出写队列最大积压块数（背压阈值）

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let error: any = null // 写入目标出错时记录，驱动输入侧解挂与停止
    let writeChain: Promise<void> = Promise.resolve()
    let pendingWrites = 0
    const waiters: (() => void)[] = []

    const waitDrain = async () => {
      while (pendingWrites >= MAX_PENDING && !error) {
        await new Promise<void>((r) => { waiters.push(r) })
      }
    }
    const maybeDrain = () => {
      if (pendingWrites < MAX_PENDING || error) {
        while (waiters.length) waiters.pop()!()
      }
    }

    /** 排队写入压缩输出；写失败记录 error（不在此 reject，交由输入侧统一停止） */
    const enqueueWrite = (dat: Uint8Array) => {
      pendingWrites++
      writeChain = writeChain
        .then(() => target.write(dat))
        .then(
          () => { pendingWrites--; maybeDrain() },
          (e) => { pendingWrites--; maybeDrain(); if (!error) error = e }
        )
    }

    const zip = new Zip((err, dat, final) => {
      if (settled) return
      if (err && !error) error = err
      if (dat && dat.length && !error) enqueueWrite(dat)
      if (final) {
        writeChain
          .then(() => {
            if (settled) return
            settled = true
            if (error) reject(error)
            else resolve()
          })
          .catch((e) => {
            if (settled) return
            settled = true
            reject(error || e)
          })
      }
    })

    const run = async () => {
      let doneBytes = 0
      let lastReport = 0
      let nextIdx = 0
      let activeIndex = 0
      let activeName = ''

      const report = () => {
        const now = Date.now()
        if (now - lastReport > 250 || doneBytes >= totalBytes) {
          lastReport = now
          onProgress({ doneBytes, totalBytes, fileIndex: activeIndex, totalFiles, currentFile: activeName, fileDoneBytes: 0, fileSize: 0 })
        }
      }

      const worker = async () => {
        for (;;) {
          if (error) return
          if (signal?.aborted) return
          const i = nextIdx++
          if (i >= entries.length) return
          const entry = entries[i]
          activeIndex = i
          activeName = entry.name
          const def = new AsyncZipDeflate(entry.name)
          zip.add(def) // 按 add 顺序组织归档，并发数据由 Zip 内部按序缓冲刷出
          try {
            const res = await fetch(getFileUrl(entry.id), { signal })
            if (!res.ok || !res.body) throw new Error(`下载失败: ${entry.name}`)
            const reader = res.body.getReader()
            for (;;) {
              if (error) { reader.cancel().catch(() => {}); def.terminate(); return }
              if (signal?.aborted) { reader.cancel().catch(() => {}); def.terminate(); return }
              await waitDrain()
              const { done, value } = await reader.read()
              if (done) break
              def.push(value)
              doneBytes += value.length
              report()
            }
            def.push(new Uint8Array(0), true) // 结束当前文件（fflate 要求 final push 必须传非 undefined chunk）
          } catch (e) {
            def.terminate()
            if (e?.name !== 'AbortError' && !error) error = e
            return
          }
        }
      }

      try {
        const n = Math.max(1, Math.min(concurrency, entries.length))
        await Promise.all(Array.from({ length: n }, () => worker()))
        if (error) throw error
        if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
        zip.end()
      } catch (e) {
        zip.terminate()
        target.abort().catch(() => {})
        if (!settled) {
          settled = true
          reject(e)
        }
      }
    }

    run()
  })
}

/** 通过 File System Access API 让用户选择保存位置（必须在用户手势内同步调用） */
export async function pickFsaTarget(suggestedName: string): Promise<(ZipTarget & PositionalZipTarget) | null> {
  if (!supportSaveFilePicker()) return null
  const w = window as any
  const handle = await w.showSaveFilePicker({
    suggestedName,
    types: [{
      description: 'ZIP 压缩文件',
      accept: { 'application/zip': ['.zip'] }
    }]
  })
  const writable = await handle.createWritable()
  return {
    write: (data) => writable.write(data),
    writeAt: (data, position) => writable.write({ type: 'write', data, position }),
    close: () => writable.close(),
    abort: (reason) => writable.abort(reason)
  }
}

/** 在 OPFS 中创建暂存文件，返回可写入的 target */
export async function createOpfsTarget(fileName: string): Promise<ZipTarget | null> {
  if (!supportOPFS()) return null
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  return {
    write: (data) => writable.write(data),
    writeAt: (data, position) => writable.write({ type: 'write', data, position }),
    close: () => writable.close(),
    abort: (reason) => writable.abort(reason)
  }
}

export async function removeOpfsFile(fileName: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(fileName)
  } catch {
    // 文件不存在或删除失败时静默忽略
  }
}

/** 把 OPFS 暂存的 zip 导出到本地（Blob 下载，兜底路径用） */
export async function saveOpfsToDisk(fileName: string, suggestedName: string): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(fileName)
  const file = await handle.getFile()
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  await removeOpfsFile(fileName)
}

export const supportDirectoryPicker = () =>
  typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function'

/** 让用户选择目标目录（必须在用户手势内同步调用；readwrite 权限用于创建子目录/文件） */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportDirectoryPicker()) return null
  const w = window as any
  return await w.showDirectoryPicker({ mode: 'readwrite' }) as FileSystemDirectoryHandle
}

/**
 * 把单个 entry 按原样（不压缩）复制到用户选择的目录，保留相对路径层级。
 * 文件流式直写（fetch → FileSystemWritableFileStream），内存只占用单个文件级别。
 * @param getFileUrl 文件下载 URL 构建函数（分享页传 /api/share/:token/download?fileId=）
 */
export async function copyEntryToDirectory(
  entry: ZipEntry,
  root: FileSystemDirectoryHandle,
  onProgress: (fileDoneBytes: number) => void,
  signal?: AbortSignal,
  getFileUrl: (id: string) => string = (id) => `/api/files/${id}/download`
): Promise<void> {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')

  const parts = entry.name.split('/')
  const fileName = parts.pop() || 'file'
  // 逐级创建子目录（保留层级）
  let dir = root
  for (const part of parts) {
    if (!part) continue
    dir = await dir.getDirectoryHandle(part, { create: true })
  }

  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  const target: ZipTarget = {
    write: (d) => writable.write(d),
    close: () => writable.close(),
    abort: (r) => writable.abort(r)
  }
  try {
    await streamUrlToTarget(
      getFileUrl(entry.id),
      target,
      entry.size,
      onProgress,
      signal
    )
    await target.close()
  } catch (e) {
    await target.abort().catch(() => {})
    throw e
  }
}

/**
 * 流式下载单个文件的原始字节到 target（方案 B 的 `response.body → writable` 直写）。
 * 每个 chunk 写完后才读下一个，天然背压；用于 FSA 直写磁盘。
 */
export async function streamUrlToTarget(
  url: string,
  target: ZipTarget,
  totalBytes: number,
  onProgress: (doneBytes: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, { signal })
  if (!res.ok || !res.body) throw new Error(`下载失败: ${url}`)
  const reader = res.body.getReader()
  let doneBytes = 0
  let lastReport = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.length) {
        await target.write(value)
        doneBytes += value.length
        const now = Date.now()
        if (now - lastReport > 250 || doneBytes >= totalBytes) {
          lastReport = now
          onProgress(doneBytes)
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

/** 兜底：流式拉取为 Blob 并返回（非 FSA 浏览器用于触发浏览器原生下载） */
export async function downloadBlobWithProgress(
  url: string,
  onProgress: (doneBytes: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(url, { signal })
  if (!res.ok || !res.body) throw new Error(`下载失败: ${url}`)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let doneBytes = 0
  let lastReport = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.length) {
        chunks.push(value)
        doneBytes += value.length
        const now = Date.now()
        if (now - lastReport > 250) {
          lastReport = now
          onProgress(doneBytes)
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  onProgress(doneBytes)
  return new Blob(chunks)
}

/**
 * 并发把 entries 按原样复制到目录（每个文件独立句柄，可并行写入）。
 * 适合「批量下载到目录」的多文件并行。
 * @param getSignal 每文件的取消信号（用于单独取消某个文件的复制）
 */
export async function copyEntriesConcurrent(
  entries: ZipEntry[],
  root: FileSystemDirectoryHandle,
  concurrency: number,
  onFileProgress: (index: number, entry: ZipEntry, fileDoneBytes: number) => void,
  onFileSettled: (index: number, entry: ZipEntry, ok: boolean, err?: any) => void,
  signal?: AbortSignal,
  getFileUrl?: (id: string) => string,
  getSignal?: (index: number) => AbortSignal | undefined
): Promise<void> {
  let next = 0
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return
      const i = next++
      if (i >= entries.length) return
      const entry = entries[i]
      const per = getSignal?.(i)
      const sig = per
        ? (signal ? AbortSignal.any([signal, per]) : per)
        : signal
      try {
        await copyEntryToDirectory(entry, root, (done) => onFileProgress(i, entry, done), sig, getFileUrl)
        onFileSettled(i, entry, true)
      } catch (e) {
        onFileSettled(i, entry, false, e)
        if (e?.name === 'AbortError') return // 用户取消：停止整个批量
      }
    }
  }
  const n = Math.max(1, Math.min(concurrency, entries.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
}

/**
 * 单个大文件的 Range 分块并发下载（默认每块 4MB），按位置写入 target。
 * 服务端需支持 HTTP Range（本项目 /api/files/:id/download 与分享接口均支持 206）。
 */
export async function downloadFileRangeParallel(
  url: string,
  size: number,
  target: PositionalZipTarget,
  concurrency: number,
  onProgress: (doneBytes: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const CHUNK = 4 * 1024 * 1024
  const parts: { start: number, end: number }[] = []
  for (let s = 0; s < size; s += CHUNK) {
    parts.push({ start: s, end: Math.min(s + CHUNK, size) - 1 })
  }
  if (!parts.length) return

  let doneBytes = 0
  let error: any = null
  let lastReport = 0
  const report = () => {
    const now = Date.now()
    if (now - lastReport > 250 || doneBytes >= size) {
      lastReport = now
      onProgress(doneBytes)
    }
  }

  let next = 0
  const worker = async () => {
    for (;;) {
      if (error || signal?.aborted) return
      const i = next++
      if (i >= parts.length) return
      const { start, end } = parts[i]
      try {
        const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal })
        if (!res.ok || !res.body) throw new Error(`分块 ${i} 下载失败`)
        const reader = res.body.getReader()
        let pos = start
        for (;;) {
          if (error || signal?.aborted) { reader.cancel().catch(() => {}); return }
          const { done, value } = await reader.read()
          if (done) break
          if (value?.length) {
            await target.writeAt(value, pos)
            pos += value.length
            doneBytes += value.length
            report()
          }
        }
      } catch (e) {
        if (e?.name !== 'AbortError' && !error) error = e
        return
      }
    }
  }
  const n = Math.max(1, Math.min(concurrency, parts.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  if (error) throw error
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
}
