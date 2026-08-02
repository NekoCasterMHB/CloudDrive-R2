/**
 * 数据库连接 — 统一通过 D1 binding（env.DB）
 *
 * @nuxthub/db 是 NuxtHub 按 `hub.db.driver = 'd1'` 生成的 Drizzle 实例
 * 本地开发：wrangler getPlatformProxy() 提供本地 D1（.wrangler/state 持久化）
 * 部署后：worker 的真实 D1 binding
 */
export { db } from '@nuxthub/db'
