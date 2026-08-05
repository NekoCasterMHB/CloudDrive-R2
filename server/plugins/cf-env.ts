/**
 * Nitro 插件 — 捕获 Cloudflare Workers env bindings
 *
 * Nitro 的 cloudflare preset 已在 dev（wrangler getPlatformProxy）与生产（fetchHandler）
 * 中把绑定注入 globalThis.__env__；本插件再兜底捕获 event.context.cloudflare.env，
 * 确保邮件发送（EMAIL binding）等服务能稳定读取到 env。
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const cf = (event as any).context?.cloudflare
    if (cf?.env) {
      const g = globalThis as any
      g.__cfEnv = cf.env
      // 兜底：若 Nitro 尚未注入 __env__（如部分自定义部署），则手动注入
      if (!g.__env__) g.__env__ = cf.env
    }
  })

  // Cloudflare cron 定时任务：每天清理已过期的回收站记录（30 天），删除 R2 对象并释放使用量
  // 对应 wrangler.toml [triggers] crons = ["0 3 * * *"]
  nitroApp.hooks.hook('cloudflare:scheduled', async () => {
    const { purgeExpiredTrash } = await import('../utils/trash-cleanup')
    await purgeExpiredTrash()
  })
})
