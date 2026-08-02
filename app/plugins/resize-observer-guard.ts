/**
 * 全局忽略良性的 ResizeObserver 循环错误。
 * "ResizeObserver loop completed with undelivered notifications" 是浏览器原生行为：
 * 当 ResizeObserver 回调中触发布局变化、导致下一帧无法送达通知时抛出，
 * 常见于 UI 库（Nuxt UI / Reka UI 的 popper、tabs indicator 等）内部测量。
 * 它不影响任何功能，但会被 Vite/Nuxt 的 error 上报捕获后刷屏终端。
 *
 * 用 capture 阶段监听 + stopImmediatePropagation 拦截，
 * 使下游（Vite client、Nuxt error 上报）的 bubble 阶段 listener 收不到该事件。
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const isBenign = (msg?: string | unknown) =>
    typeof msg === 'string' && msg.includes('ResizeObserver loop')

  window.addEventListener(
    'error',
    (e) => {
      if (isBenign(e?.message)) {
        e.stopImmediatePropagation()
      }
    },
    true
  )

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const r = e?.reason
      const msg = r instanceof Error ? r.message : typeof r === 'string' ? r : ''
      if (isBenign(msg)) {
        e.stopImmediatePropagation()
      }
    },
    true
  )
})
