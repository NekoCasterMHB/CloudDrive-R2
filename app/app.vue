<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale'

const { locale } = useI18n()

// 应用启动时从 D1 拉取设置（缓存等依赖设置的功能立即可用，随后被 D1 值覆盖）
const { load: loadSettings } = useSettings()
onMounted(() => {
  loadSettings()
})

const uiLocale = computed(() => {
  const map: Record<string, keyof typeof uiLocales> = {
    'zh-CN': 'zh_cn',
    'ja': 'ja',
    'en': 'en'
  }
  return uiLocales[map[locale.value] ?? 'en']
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#3b82f6' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'CloudDrive' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
    { rel: 'apple-touch-icon', href: '/icons/icon-192.png' }
  ],
  htmlAttrs: {
    lang: 'zh-CN'
  }
})

useSeoMeta({
  title: 'CloudDrive R2',
  description: '个人私有云盘 — 基于 Cloudflare R2 的 PWA 云存储',
  ogTitle: 'CloudDrive R2',
  ogDescription: '个人私有云盘',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
    <PwaManager />
  </UApp>
</template>
