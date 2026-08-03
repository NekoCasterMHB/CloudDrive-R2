// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxthub/core',
    '@nuxtjs/i18n',
    '@vite-pwa/nuxt'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  // 运行时配置（参考 Better Auth 官方 + Cloudflare Email 集成）
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }]
    }
  },

  css: ['~/assets/css/main.css'],

  // Nuxt UI 启用颜色模式（注册 ColorModeButton 等组件，并自动引入 @nuxtjs/color-mode）
  ui: {
    colorMode: true
  },
  runtimeConfig: {
    betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
    betterAuthUrl: process.env.BETTER_AUTH_URL || '',
    // Cloudflare Email Service — 本地 dev 真实发送
    cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    cfApiTokenEmail: process.env.CF_API_TOKEN_SEND_EMAIL || '',
    devConsoleEmail: process.env.DEV_CONSOLE_EMAIL || '',
    email: {
      from: process.env.EMAIL_FROM || 'no-reply@yourdomain.com',
      fromName: 'CloudDrive'
    }
  },

  routeRules: {
    '/': { prerender: true }
  },

  devServer: {
    port: 3366
  },

  compatibilityDate: '2026-06-30',

  // Cloudflare Workers 部署
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
  },

  // NuxtHub: 统一通过 Cloudflare bindings（D1 绑定 + R2 绑定）
  // 本地开发：wrangler getPlatformProxy() 提供本地 Miniflare 绑定（.wrangler/state 持久化）
  // 部署后：worker 真实绑定，代码路径完全一致
  hub: {
    db: {
      dialect: 'sqlite',
      // 开发环境连云端 D1/R2：通过 wrangler.toml 里绑定的 `remote = true`（Cloudflare remote bindings）
      // `npm run dev` 走 getPlatformProxy 直连云端资源，无需 API Token；部署时 remote 字段被忽略、始终用真实绑定
      driver: 'd1'
    },
    blob: false
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // i18n 多语言
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh-CN',
    locales: [
      { code: 'zh-CN', name: '中文', language: 'zh-CN' },
      { code: 'ja', name: '日本語', language: 'ja' },
      { code: 'en', name: 'English', language: 'en' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale'
    }
  },

  // PWA
  pwa: {
    registerType: 'autoUpdate',
    devOptions: {
      enabled: true
    },
    manifest: {
      name: 'CloudDrive R2',
      short_name: 'CloudDrive',
      description: '个人私有云盘 — 基于 Cloudflare R2 的个人云存储',
      lang: 'zh-CN',
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      navigateFallback: '/index.html'
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600
    }
  }
})
