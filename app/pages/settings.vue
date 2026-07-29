<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 h-14 gap-3">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" @click="navigateTo('/')" />
        <h1 class="text-lg font-semibold">{{ $t('app.settings') }}</h1>
      </div>
    </header>

    <div class="max-w-lg mx-auto p-4 space-y-6">
      <!-- 账户 -->
      <UCard>
        <template #header><h2 class="font-semibold">{{ $t('app.account') }}</h2></template>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('app.email') }}</span>
            <span>{{ user?.email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('app.storage') }}</span>
            <span>{{ formatSize(user?.storageUsed ?? 0) }} / {{ formatSize(user?.storageLimit ?? 0) }}</span>
          </div>
        </div>
      </UCard>

      <!-- 语言 -->
      <UCard>
        <template #header><h2 class="font-semibold">Language / 言語</h2></template>
        <div class="flex gap-2">
          <UButton v-for="locale in locales" :key="locale.code"
            :variant="locale.code === currentLocale ? 'solid' : 'outline'"
            size="sm" @click="switchLocale(locale.code)">
            {{ locale.name }}
          </UButton>
        </div>
      </UCard>

      <!-- 关于 -->
      <UCard>
        <template #header><h2 class="font-semibold">{{ $t('app.about') }}</h2></template>
        <div class="space-y-2 text-sm text-gray-500">
          <p>CloudDrive R2 v1.0.0</p>
          <p>{{ $t('app.aboutDesc') }}</p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
const { locale, locales, setLocale } = useI18n()
const currentLocale = computed(() => locale.value)

async function switchLocale(code: string) {
  await setLocale(code)
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}
</script>
