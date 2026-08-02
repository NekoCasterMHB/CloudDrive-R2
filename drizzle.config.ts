import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // 完整数据库初始化脚本：server/db/init.sql（整合 migrations/sqlite 0000~0005）
    //   - 本地 D1：npx wrangler d1 execute clouddrive-db --local --file=server/db/init.sql
    //   - 线上 D1：npx wrangler d1 execute clouddrive-db --remote --file=server/db/init.sql
    // drizzle-kit 仅用于从 schema 生成增量 SQL（pnpm db:generate → drizzle/xxx.sql）
    url: './.data/auth.db'
  }
})
