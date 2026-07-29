/**
 * Nitro 插件 — 捕获 Cloudflare Workers env bindings
 * 使得 Better Auth 的 sendVerificationOTP 回调能访问 env.EMAIL
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const cf = (event as any).context?.cloudflare
    if (cf?.env) {
      ;(globalThis as any).__cfEnv = cf.env
    }
  })
})
