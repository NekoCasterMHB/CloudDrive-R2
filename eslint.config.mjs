// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // 项目以 `any` 处理动态数据（R2/D1 绑定、API 响应、mock 数据等），
      // 未安装 @cloudflare/workers-types，属于既有代码模式，关闭该规则
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
  // Your custom configs here
)
