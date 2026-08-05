/**
 * 传输速度采样与格式化工具
 * 用 WeakMap 记录每个任务的采样序列（时间 + 累计字节），避免污染任务对象字段；
 * 采用下载软件通用的「滑动窗口平均速度」算法：速度 = 最近 2 秒窗口内字节数 / 时间，
 * 平滑掉瞬时突发，避免出现远超实际速率的尖峰。
 */

interface SpeedSample {
  times: number[]
  bytes: number[]
}
const samples = new WeakMap<object, SpeedSample>()

/** 速度计算滑动窗口（毫秒） */
const WINDOW_MS = 2000
/** 采样最小间隔（毫秒）：低于该间隔的调用直接忽略，避免高频 onprogress 产生巨量采样点 */
const MIN_INTERVAL_MS = 100

/** 采样一次（bytes = 当前累计字节数），更新 task.speed（B/s） */
export function trackSpeed(task: { speed?: number }, bytes: number, now: number = Date.now()) {
  let s = samples.get(task)
  if (!s) {
    s = { times: [], bytes: [] }
    samples.set(task, s)
  }
  // 采样间隔下限
  const lastT = s.times[s.times.length - 1]
  if (lastT != null && now - lastT < MIN_INTERVAL_MS) return

  s.times.push(now)
  s.bytes.push(bytes)
  // 丢弃窗口外旧采样，保持窗口内至少 2 个点
  while (s.times.length > 1 && now - s.times[0] > WINDOW_MS) {
    s.times.shift()
    s.bytes.shift()
  }
  if (s.times.length < 2) return // 需要至少两个采样点才计算

  const dt = (now - s.times[0]) / 1000
  const db = bytes - s.bytes[0]
  if (dt <= 0 || db < 0) return // 防除零 / 字节回退
  task.speed = db / dt
}

/** 格式化传输速度：0 B/s → B/s → KB/s → MB/s → GB/s */
export function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s'
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.min(Math.floor(Math.log(bytesPerSec) / Math.log(1024)), u.length - 1)
  return `${(bytesPerSec / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}
