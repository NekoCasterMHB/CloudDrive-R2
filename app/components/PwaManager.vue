<script setup lang="ts">
const { $pwa } = useNuxtApp()
const { t } = useI18n()
const toast = useToast()

// SW 注册失败提示
watch(
  () => $pwa.registrationError,
  (v) => {
    if (v) toast.add({ title: t('app.pwaSwFailed'), icon: 'i-lucide-triangle-alert', color: 'error' })
  }
)
</script>

<template>
  <!-- 新版本可用：更新横幅 -->
  <div
    v-if="$pwa.needRefresh"
    class="fixed bottom-4 right-4 z-90 flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 shadow-lg px-4 py-3"
  >
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-refresh-cw" class="mt-0.5 text-xl text-blue-500 shrink-0" />
      <div class="min-w-0">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('app.pwaNewVersion') }}</p>
        <p class="text-xs text-gray-500">{{ t('app.pwaNewVersionDesc') }}</p>
      </div>
    </div>
    <div class="flex gap-2 justify-end">
      <UButton size="sm" variant="soft" :label="t('app.pwaLater')" @click="$pwa.cancelPrompt()" />
      <UButton size="sm" color="primary" :label="t('app.pwaUpdate')" icon="i-lucide-download" @click="$pwa.updateServiceWorker()" />
    </div>
  </div>

  <!-- 安装提示：横幅（beforeinstallprompt 触发） -->
  <div
    v-if="$pwa.showInstallPrompt && !$pwa.isPWAInstalled"
    class="fixed bottom-4 right-4 z-90 flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg px-4 py-3 max-w-sm"
  >
    <div class="flex items-start gap-3">
      <img src="/icons/icon-192.png" alt="CloudDrive" class="h-10 w-10 rounded-lg object-cover shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('app.pwaInstallTitle') }}</p>
        <p class="text-xs text-gray-500">{{ t('app.pwaInstallDesc') }}</p>
      </div>
    </div>
    <div class="flex gap-2 justify-end">
      <UButton size="sm" variant="ghost" :label="t('app.pwaLater')" @click="$pwa.cancelInstall()" />
      <UButton size="sm" color="primary" :label="t('app.pwaInstall')" icon="i-lucide-download" @click="$pwa.install()" />
    </div>
  </div>
</template>
