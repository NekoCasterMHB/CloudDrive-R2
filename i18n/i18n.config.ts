import zhCN from './locales/zh-CN.json'
import en from './locales/en.json'
import ja from './locales/ja.json'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
    ja,
  },
}))
