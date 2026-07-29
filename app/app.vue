<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale'

const { locale } = useI18n()

const uiLocale = computed(() => {
  const map: Record<string, keyof typeof uiLocales> = {
    'zh-CN': 'zh_cn',
    'ja': 'ja',
    'en': 'en',
  }
  return uiLocales[map[locale.value] ?? 'en']
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
  ],
  htmlAttrs: {
    lang: 'zh-CN',
  },
})

useSeoMeta({
  title: 'CloudDrive R2',
  description: '个人私有云盘 — 基于 Cloudflare R2 的 PWA 云存储',
  ogTitle: 'CloudDrive R2',
  ogDescription: '个人私有云盘',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
