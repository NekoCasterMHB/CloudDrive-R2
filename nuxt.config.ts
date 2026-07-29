// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxthub/core',
    '@nuxtjs/i18n',
    '@vite-pwa/nuxt',
  ],

  // NuxtHub: 本地 dev 直连云端 D1 + R2
  hub: {
    db: {
      dialect: 'sqlite',
      driver: 'd1-http',
    },
    blob: true,
  },

  devtools: {
    enabled: true,
  },

  devServer: {
    port: 3366,
  },

  ssr: false,

  // i18n 多语言
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh-CN',
    locales: [
      { code: 'zh-CN', name: '中文', language: 'zh-CN' },
      { code: 'ja', name: '日本語', language: 'ja' },
      { code: 'en', name: 'English', language: 'en' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
    },
  },

  css: ['~/assets/css/main.css'],

  // 运行时配置（参考 Better Auth 官方 + Cloudflare Email 集成）
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },

  runtimeConfig: {
    betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
    betterAuthUrl: process.env.BETTER_AUTH_URL || '',
    // Cloudflare Email Service — 本地 dev 真实发送
    cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || process.env.NUXT_HUB_CLOUDFLARE_ACCOUNT_ID || '',
    cfApiTokenEmail: process.env.CF_API_TOKEN_SEND_EMAIL || '',
    devConsoleEmail: process.env.DEV_CONSOLE_EMAIL || '',
    email: {
      from: process.env.EMAIL_FROM || 'no-reply@yourdomain.com',
      fromName: 'CloudDrive',
    },
  },

  // Cloudflare Workers 部署
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },

  // PWA
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'CloudDrive R2',
      short_name: 'CloudDriveR2',
      description: '个人私有云盘',
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    },
    client: {
      installPrompt: true,
    },
  },

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
})
