/**
 * 并发传输设置读取
 * 从 useSettings 的 localStorage 兜底（key: clouddrive_settings）读取，
 * 默认 3，范围 1-5。下载逻辑（主界面 / 分享页）共用。
 */
export function getConcurrencySetting(): number {
  if (typeof localStorage === 'undefined') return 3
  try {
    const raw = localStorage.getItem('clouddrive_settings')
    if (!raw) return 3
    const p = JSON.parse(raw)
    const n = Number(p?.concurrentDownloads)
    if (Number.isFinite(n)) return Math.min(5, Math.max(1, Math.round(n)))
    return 3
  } catch {
    return 3
  }
}
