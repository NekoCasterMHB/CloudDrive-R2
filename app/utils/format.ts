/**
 * 传输大小格式化工具
 * formatSizePair：done 与 total 使用同一单位展示（如 `0.0 MB / 5.0 MB`），
 * 避免任务未开始时出现 `0 B / 5.0 MB` 或缺失已完成部分（` / 5.0 MB`）的单位不一致问题。
 */
export function formatSizePair(done: number, total: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const t = Math.max(total || 0, 0)
  // 以总大小决定单位刻度，保证 done 与 total 同单位、可直接比较
  const i = Math.min(Math.floor(Math.log(t || 1) / Math.log(1024)), u.length - 1)
  const scale = 1024 ** i
  const unit = u[i]
  const fmt = (v: number) => `${(Math.max(v, 0) / scale).toFixed(1)} ${unit}`
  return `${fmt(done)} / ${fmt(total)}`
}
