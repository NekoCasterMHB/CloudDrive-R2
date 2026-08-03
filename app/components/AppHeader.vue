<script setup lang="ts">
import { LazyShareManagerModal } from '#components'

const { t, locale, locales, setLocale } = useI18n()
const { user, logout, refreshStorage } = useAuth()
const overlay = useOverlay()

function formatSize(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

const langMenuItems = computed(() => {
  const name = (code: string) => locales.value.find(l => l.code === code)?.name ?? code
  return [
    [
      { label: name('zh-CN'), icon: 'i-flag:cn-4x3', type: 'checkbox' as const, checked: locale.value === 'zh-CN', onUpdateChecked() { setLocale('zh-CN') } },
      { label: name('ja'), icon: 'i-flag:jp-4x3', type: 'checkbox' as const, checked: locale.value === 'ja', onUpdateChecked() { setLocale('ja') } },
      { label: name('en'), icon: 'i-flag:us-4x3', type: 'checkbox' as const, checked: locale.value === 'en', onUpdateChecked() { setLocale('en') } }
    ]
  ]
})

function openShareManager() {
  overlay.create(LazyShareManagerModal).open({})
}

/** 存储占用百分比（0-100，完全向上进位不舍，保留 1 位小数） */
const storagePercent = computed(() => {
  const used = Number(user.value?.storageUsed ?? 0)
  const limit = Number(user.value?.storageLimit ?? 0)
  if (limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.ceil((used / limit) * 1000) / 10))
})

function onUserMenuOpen(open: boolean) {
  if (open) refreshStorage()
}

const menuItems = computed(() => [
  [
    { type: 'label' as const, slot: 'user-header', label: '' }
  ],
  [
    { type: 'label' as const, slot: 'storage', label: '' }
  ],
  [
    ...(user.value?.role === 'admin' ? [
      { label: t('app.userManagement'), icon: 'i-lucide-users', to: '/settings?tab=users' }
    ] : []),
    { label: t('app.shareManager'), icon: 'i-lucide-share-2', onSelect: () => openShareManager() },
    { label: t('app.settings'), icon: 'i-lucide-settings', to: '/settings' },
    { label: t('app.logout'), icon: 'i-lucide-log-out', onSelect: () => logout() }
  ]
])
</script>

<template>
  <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
    <div class="flex items-center px-4 h-14 gap-3">
      <NuxtLink
        to="/"
        class="flex items-center gap-3 min-w-0 group"
      >
        <img
          :src="'/logo.png'"
          alt="CloudDrive"
          class="h-8 w-8 rounded-lg object-cover"
        >
        <h1 class="text-lg font-semibold truncate group-hover:text-primary transition-colors">
          CloudDrive
        </h1>
      </NuxtLink>

      <div class="flex-1" />

      <slot name="right" />

      <UDropdownMenu :items="langMenuItems">
        <UButton
          icon="i-lucide-languages"
          variant="ghost"
          size="md"
        />
      </UDropdownMenu>

      <UColorModeButton
        color="primary"
        variant="ghost"
        size="md"
      />

      <UDropdownMenu
        :items="menuItems"
        @update:open="onUserMenuOpen"
      >
        <template #user-header>
          <div class="flex items-center gap-2 px-1 py-0.5 min-w-52">
            <UIcon
              name="i-lucide-user-round"
              class="size-4 text-gray-500 dark:text-gray-400 shrink-0"
            />
            <span class="text-sm font-medium truncate flex-1">{{ user?.email || t('app.notLoggedIn') }}</span>
            <UBadge
              v-if="user?.role === 'admin'"
              color="primary"
              size="sm"
              variant="subtle"
              :label="t('app.admin')"
            />
          </div>
        </template>
        <UButton
          icon="i-lucide-user-round"
          variant="ghost"
          size="md"
        />
        <template #storage>
          <div class="px-1 py-1 min-w-56">
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <UIcon
                name="i-lucide-hard-drive"
                class="text-base shrink-0"
              />
              <span class="flex-1 min-w-0">{{ formatSize(user?.storageUsed ?? 0) }} / {{ (user?.storageLimit ?? 0) <= 0 ? t('app.cacheSizeUnlimited') : formatSize(user?.storageLimit ?? 0) }}</span>
              <span>{{ storagePercent.toFixed(1) }}%</span>
            </div>
            <UProgress
              :model-value="storagePercent"
              size="sm"
              color="primary"
            />
          </div>
        </template>
      </UDropdownMenu>
    </div>
  </header>
</template>
