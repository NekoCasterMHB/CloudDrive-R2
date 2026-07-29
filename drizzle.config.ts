import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // D1 数据库 ID（从 Cloudflare Dashboard 获取）
    // 迁移时使用: pnpm wrangler d1 execute clouddrive-db --file=./drizzle/xxx.sql
    url: './.data/auth.db',
  },
})
