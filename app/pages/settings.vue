<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <AppHeader />

    <div class="max-w-4xl mx-auto p-4 flex gap-6 items-start">
      <!-- 左侧导航 -->
      <aside class="w-44 shrink-0 sticky top-16 hidden sm:block">
        <nav class="flex flex-col gap-1">
          <button
            v-for="item in settingsNavItems"
            :key="item.key"
            class="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors"
            :class="activeSettingsTab === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'"
            @click="activeSettingsTab = item.key"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0"
            />
            <span class="truncate">{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 右侧内容 -->
      <div class="flex-1 min-w-0 space-y-6">
        <!-- 移动端导航 -->
        <div class="flex sm:hidden gap-1 overflow-x-auto">
          <button
            v-for="item in settingsNavItems"
            :key="item.key"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors"
            :class="activeSettingsTab === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 dark:text-gray-400'"
            @click="activeSettingsTab = item.key"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0"
            />
            {{ item.label }}
          </button>
        </div>

        <!-- 系统设置面板 -->
        <div
          v-show="activeSettingsTab === 'settings'"
          class="space-y-6"
        >
          <!-- 账户 -->
          <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ $t('app.account') }}
          </h2>
        </template>
        <div
          v-if="groupName"
          class="mb-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
        >
          <UIcon
            name="i-lucide-shield-check"
            class="size-4 mt-px shrink-0"
          />
          <span>{{ $t('app.groupManagedHint', { group: groupName }) }}</span>
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('app.email') }}</span>
            <span>{{ user?.email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('app.userGroup') }}</span>
            <span>{{ groupName || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">{{ $t('app.storage') }}</span>
            <span>{{ formatSize(user?.storageUsed ?? 0) }} / {{ appSettings.storageLimit <= 0 ? $t('app.cacheSizeUnlimited') : formatSize(appSettings.storageLimit) }}</span>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
            <div>
              <p class="font-medium">
                {{ $t('app.storageLimit') }}
              </p>
              <p
                v-if="storageLimitManaged"
                class="text-xs text-amber-500 mt-0.5 flex items-center gap-1"
              >
                <UIcon
                  name="i-lucide-lock"
                  class="text-xs"
                />{{ $t('app.managedByAdmin') }}
              </p>
              <p
                v-else
                class="text-xs text-gray-400 mt-0.5"
              >
                {{ $t('app.storageLimitHint') }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-sm font-medium">{{ storageLimitDisplay }}</span>
              <UButton
                v-if="!isTestUser && !storageLimitManaged"
                icon="i-lucide-pencil"
                variant="outline"
                size="sm"
                @click="openStorageModal"
              >
                {{ $t('app.edit') }}
              </UButton>
            </div>
          </div>

          <!-- 修改密码：按钮在右侧，点击弹出模态框 -->
          <div class="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
            <div>
              <p class="font-medium">
                {{ $t('app.changePassword') }}
              </p>
              <p
                v-if="!canChangePassword"
                class="text-xs text-amber-500 mt-0.5 flex items-center gap-1"
              >
                <UIcon
                  name="i-lucide-lock"
                  class="text-xs"
                />{{ $t('app.managedByAdmin') }}
              </p>
              <p
                v-else
                class="text-xs text-gray-400 mt-0.5"
              >
                {{ $t('app.changePasswordHint') }}
              </p>
            </div>
            <UButton
              v-if="!isTestUser && canChangePassword"
              icon="i-lucide-key-round"
              color="primary"
              variant="outline"
              size="sm"
              class="shrink-0"
              @click="openChangePwdModal"
            >
              {{ $t('app.changePasswordSubmit') }}
            </UButton>
          </div>

          <!-- 语言：下拉框选择 -->
          <div class="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
            <div>
              <p class="font-medium">
                {{ $t('app.language') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ $t('app.languageHint') }}
              </p>
            </div>
            <USelectMenu
              :model-value="currentLocale"
              :items="languageOptions"
              value-key="code"
              label-key="name"
              :search-input="false"
              leading
              class="w-44 shrink-0"
              @update:model-value="switchLocale"
            >
              <template #leading="{ modelValue }">
                <UIcon
                  :name="languageFlag(modelValue as string)"
                  class="text-base shrink-0"
                />
              </template>
            </USelectMenu>
          </div>
        </div>
      </UCard>

      <!-- 修改密码模态框 -->
      <UModal
        v-model:open="showChangePwdModal"
        :title="$t('app.changePassword')"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <form
            class="space-y-3"
            @submit.prevent="handleChangePassword"
          >
            <UFormField :label="$t('app.currentPassword')">
              <UInput
                v-model="pwdCurrent"
                type="password"
                :placeholder="$t('app.currentPassword')"
                autocomplete="current-password"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('app.newPassword')">
              <UInput
                v-model="pwdNew"
                type="password"
                :placeholder="$t('app.newPassword')"
                autocomplete="new-password"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('app.confirmNewPassword')">
              <UInput
                v-model="pwdConfirm"
                type="password"
                :placeholder="$t('app.confirmNewPassword')"
                autocomplete="new-password"
                class="w-full"
              />
            </UFormField>
            <p
              v-if="pwdError"
              class="text-xs text-red-500"
            >
              {{ pwdError.startsWith('app.') ? $t(pwdError) : pwdError }}
            </p>
            <p
              v-if="pwdSuccess"
              class="text-xs text-green-500"
            >
              {{ $t('app.passwordChanged') }}
            </p>
          </form>
        </template>
        <template #footer>
          <UButton
            color="neutral"
            variant="ghost"
            @click="showChangePwdModal = false"
          >
            {{ $t('app.cancel') }}
          </UButton>
          <UButton
            icon="i-lucide-key-round"
            color="primary"
            :loading="changingPassword"
            @click="handleChangePassword"
          >
            {{ $t('app.changePasswordSubmit') }}
          </UButton>
        </template>
      </UModal>

      <!-- 云盘存储上限模态框 -->
      <UModal
        v-model:open="showStorageModal"
        :title="$t('app.storageLimit')"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <div class="space-y-3">
            <div class="flex items-end gap-2">
              <UInput
                v-model="storageTempValue"
                type="number"
                min="0.1"
                step="0.1"
                class="flex-1"
                :disabled="storageTempUnlimited"
                :ui="{ base: storageTempUnlimited ? 'opacity-40 pointer-events-none' : '' }"
                :placeholder="$t('app.cacheSizePlaceholder')"
              />
              <USelectMenu
                v-model="storageTempUnit"
                :items="storageLimitUnitOptions"
                value-key="value"
                :search-input="false"
                :disabled="storageTempUnlimited"
                class="shrink-0"
              />
            </div>
            <div class="flex items-center justify-between gap-3 pt-1">
              <span class="text-sm text-gray-500">{{ $t('app.cacheSizeUnlimited') }}</span>
              <USwitch v-model="storageTempUnlimited" />
            </div>
          </div>
        </template>
        <template #footer>
          <UButton
            color="neutral"
            variant="ghost"
            @click="showStorageModal = false"
          >
            {{ $t('app.cancel') }}
          </UButton>
          <UButton
            icon="i-lucide-check"
            color="primary"
            @click="saveStorageLimit"
          >
            {{ $t('app.save') }}
          </UButton>
        </template>
      </UModal>

      <!-- 缓存容量模态框 -->
      <UModal
        v-model:open="showCacheModal"
        :title="$t('app.cacheMaxSize')"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <div class="space-y-3">
            <div class="flex items-end gap-2">
              <UInput
                v-model="cacheTempValue"
                type="number"
                min="0.1"
                step="0.1"
                class="flex-1"
                :disabled="cacheTempUnlimited"
                :ui="{ base: cacheTempUnlimited ? 'opacity-40 pointer-events-none' : '' }"
                :placeholder="$t('app.cacheSizePlaceholder')"
              />
              <USelectMenu
                v-model="cacheTempUnit"
                :items="cacheSizeUnitOptions"
                value-key="value"
                :search-input="false"
                :disabled="cacheTempUnlimited"
                class="shrink-0"
              />
            </div>
            <div class="flex items-center justify-between gap-3 pt-1">
              <span class="text-sm text-gray-500">{{ $t('app.cacheSizeUnlimited') }}</span>
              <USwitch v-model="cacheTempUnlimited" />
            </div>
          </div>
        </template>
        <template #footer>
          <UButton
            color="neutral"
            variant="ghost"
            @click="showCacheModal = false"
          >
            {{ $t('app.cancel') }}
          </UButton>
          <UButton
            icon="i-lucide-check"
            color="primary"
            @click="saveCacheSize"
          >
            {{ $t('app.save') }}
          </UButton>
        </template>
      </UModal>

      <!-- 上传设置 -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ $t('app.uploadSettings') }}
          </h2>
        </template>
        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ $t('app.chunkSize') }}
              </p>
              <p
                v-if="chunkSizeManaged"
                class="text-xs text-amber-500 mt-0.5 flex items-center gap-1"
              >
                <UIcon
                  name="i-lucide-lock"
                  class="text-xs"
                />{{ $t('app.managedByAdmin') }}
              </p>
              <p
                v-else
                class="text-xs text-gray-400 mt-0.5"
              >
                {{ $t('app.chunkSizeHint') }}
              </p>
            </div>
            <USelect
              v-model="chunkSize"
              :items="chunkOptions"
              class="w-36 shrink-0"
              :disabled="chunkSizeManaged"
            />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ $t('app.concurrentDownloads') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ $t('app.concurrentDownloadsHint') }}
              </p>
            </div>
            <USelect
              v-model="concurrentDownloads"
              :items="concurrentOptions"
              class="w-36 shrink-0"
            />
          </div>
        </div>
      </UCard>

      <!-- 同步文件索引 -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ $t('app.fileIndex') }}
          </h2>
        </template>
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-gray-500">
                {{ $t('app.fileIndexHint') }}
              </p>
              <p class="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-history"
                  class="text-gray-400"
                />
                {{ $t('app.lastSync') }}：{{ lastSyncDisplay }}
              </p>
            </div>
            <UButton
              icon="i-lucide-refresh-cw"
              color="primary"
              :loading="syncing"
              class="shrink-0"
              @click="syncIndex"
            >
              {{ $t('app.syncFileIndex') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- 预览缓存设置 -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ $t('app.cacheSettings') }}
          </h2>
        </template>
        <div class="space-y-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ $t('app.cacheEnabled') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ $t('app.cacheEnabledHint') }}
              </p>
            </div>
            <USwitch v-model="cacheEnabled" />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ $t('app.cacheMaxSize') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ $t('app.cacheMaxSizeHint') }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-sm font-medium">{{ cacheMaxSizeDisplay }}</span>
              <UButton
                icon="i-lucide-pencil"
                variant="outline"
                size="sm"
                @click="openCacheModal"
              >
                {{ $t('app.edit') }}
              </UButton>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ $t('app.cacheTypes') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ $t('app.cacheTypesHint') }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 shrink-0 justify-end">
              <UButton
                v-for="opt in cacheTypeOptions"
                :key="opt.value"
                size="sm"
                :variant="cacheSettings.types.includes(opt.value) ? 'solid' : 'outline'"
                :icon="cacheSettings.types.includes(opt.value) ? 'i-lucide-check' : 'i-lucide-x'"
                @click="toggleCacheType(opt.value)"
              >
                {{ opt.label }}
              </UButton>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
            <div>
              <p class="font-medium">
                {{ $t('app.cacheUsage') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ formatSize(cacheStats.size) }} / {{ cacheSettings.maxSize <= 0 ? $t('app.cacheSizeUnlimited') : formatSize(cacheSettings.maxSize) }} · {{ cacheStats.count }} {{ $t('app.cacheFileCount') }}
              </p>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="outline"
              size="sm"
              :loading="clearingCache"
              :disabled="cacheStats.count === 0"
              @click="openClearCacheConfirm"
            >
              {{ $t('app.cacheClear') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- 关于 -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ $t('app.about') }}
          </h2>
        </template>
        <div class="space-y-2 text-sm text-gray-500">
          <p>CloudDrive R2 v1.0.0</p>
          <p>{{ $t('app.aboutDesc') }}</p>
        </div>
      </UCard>
        </div><!-- /系统设置面板 -->

        <!-- 分享管理面板 -->
        <div
          v-show="activeSettingsTab === 'shares'"
          class="space-y-6"
        >
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                {{ $t('app.shareManager') }}
              </h2>
            </template>
            <ShareManagerList />
          </UCard>
        </div>

        <!-- 用户管理面板（仅管理员，且仅激活时挂载，避免非管理员 403 请求） -->
        <div
          v-if="user?.role === 'admin' && activeSettingsTab === 'users'"
          class="space-y-6"
        >
          <UserManagerContent />
        </div>
      </div><!-- /右侧内容 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { LazyConfirmModal } from '#components'

definePageMeta({ middleware: 'auth' })

const { user, changePassword } = useAuth()

/** 测试账号：存储上限固定 100MB，不允许修改 */
const isTestUser = computed(() => user.value?.id === 'test-user')
const { locale, setLocale, t } = useI18n()
const currentLocale = computed(() => locale.value)

// 语言选项（带长方形国旗图标，维持 4:3 比例）
const languageOptions = [
  { code: 'zh-CN', name: '中文', icon: 'i-flag:cn-4x3' },
  { code: 'ja', name: '日本語', icon: 'i-flag:jp-4x3' },
  { code: 'en', name: 'English', icon: 'i-flag:us-4x3' }
]

/** 根据语言 code 返回国旗图标 */
function languageFlag(code: string): string | undefined {
  return languageOptions.find(l => l.code === code)?.icon
}
const toast = useToast()

// Upload settings（存 D1）
const chunkOptions = [
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '20 MB', value: 20 * 1024 * 1024 },
  { label: '50 MB', value: 50 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 }
]
const chunkSize = computed({
  get: () => appSettings.value.uploadChunkSize,
  set: (v: number) => saveSettings({ uploadChunkSize: v })
})

// 并发传输数（1-5，默认 3）：影响同时下载/打包的文件数
const concurrentOptions = [1, 2, 3, 4, 5].map(v => ({ label: String(v), value: v }))
const concurrentDownloads = computed({
  get: () => appSettings.value.concurrentDownloads,
  set: (v: number) => saveSettings({ concurrentDownloads: v })
})

async function switchLocale(code: string) {
  await setLocale(code)
}

// 同步文件索引
const { fullSync, lastSyncAt, clearIndexCache } = useFileIndex()
const syncing = ref(false)
const lastSyncDisplay = computed(() => {
  if (!lastSyncAt.value) return t('app.neverSynced')
  const d = new Date(lastSyncAt.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})
async function syncIndex() {
  syncing.value = true
  try {
    // 先清空本地索引缓存（IndexedDB/localStorage/内存），再以服务端为准全量重建，
    // 彻底清除已删除文件在本地缓存的残留引用（否则刷新主页仍会请求旧 id 导致 404）
    await clearIndexCache()
    await fullSync()
    toast.add({ title: t('app.indexSynced'), icon: 'i-lucide-circle-check', duration: 2500 })
  } finally {
    syncing.value = false
  }
}

// 设置中心侧边栏导航（派生 computed：随 ?tab= 查询参数与用户角色自动响应）
const route = useRoute()
const settingsNavItems = computed(() => [
  { key: 'settings', label: t('app.settings'), icon: 'i-lucide-settings' },
  { key: 'shares', label: t('app.shareManager'), icon: 'i-lucide-share-2' },
  ...(user.value?.role === 'admin' ? [{ key: 'users', label: t('app.userManagement'), icon: 'i-lucide-users' }] : [])
])
const activeSettingsTab = computed({
  get() {
    const tab = route.query.tab
    if (tab === 'users') return user.value?.role === 'admin' ? 'users' : 'settings'
    if (tab === 'shares') return 'shares'
    return 'settings'
  },
  set(v: 'settings' | 'shares' | 'users') {
    navigateTo({ path: route.path, query: { ...route.query, tab: v } }, { replace: true })
  }
})

// 应用设置（D1 持久化）
const { settings: appSettings, save: saveSettings, load: loadSettings, managed, canChangePassword, groupName } = useSettings()

// 用户组统一管理的设置项（设置页禁用并提示）
const storageLimitManaged = computed(() => managed.value.includes('storageLimit'))
const chunkSizeManaged = computed(() => managed.value.includes('uploadChunkSize'))

// 修改密码
const showChangePwdModal = ref(false)
const pwdCurrent = ref('')
const pwdNew = ref('')
const pwdConfirm = ref('')
const changingPassword = ref(false)
const pwdError = ref('')
const pwdSuccess = ref(false)

function openChangePwdModal() {
  pwdError.value = ''
  pwdSuccess.value = false
  showChangePwdModal.value = true
}

async function handleChangePassword() {
  pwdError.value = ''
  pwdSuccess.value = false
  if (pwdNew.value.length < 6) {
    pwdError.value = 'app.passwordTooShort'
    return
  }
  if (pwdNew.value !== pwdConfirm.value) {
    pwdError.value = 'app.passwordMismatch'
    return
  }
  changingPassword.value = true
  try {
    await changePassword(pwdCurrent.value, pwdNew.value)
    pwdSuccess.value = true
    pwdCurrent.value = ''
    pwdNew.value = ''
    pwdConfirm.value = ''
    showChangePwdModal.value = false
  } catch (e: any) {
    pwdError.value = e?.message || 'app.changePasswordFailed'
  } finally {
    changingPassword.value = false
  }
}

// 预览缓存设置
const { settings: cacheSettings, stats: cacheStats, updateSettings, clearCache, refreshStats } = useFileCache()

const cacheEnabled = computed({
  get: () => cacheSettings.value.enabled,
  set: (v: boolean) => updateSettings({ enabled: v })
})

const cacheSizeUnitOptions = [
  { label: 'MB', value: 'MB' },
  { label: 'GB', value: 'GB' },
  { label: 'TB', value: 'TB' }
]
const UNIT_BYTES = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 } as const
type CacheSizeUnit = 'MB' | 'GB' | 'TB'

// 云盘存储上限（存 D1，默认 1TB）
const STORAGE_UNIT_BYTES = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 } as const
type StorageLimitUnit = 'MB' | 'GB' | 'TB'
const storageLimitUnitOptions = [
  { label: 'MB', value: 'MB' },
  { label: 'GB', value: 'GB' },
  { label: 'TB', value: 'TB' }
]

// ---------- 当前值显示 ----------
const storageLimitDisplay = computed(() =>
  appSettings.value.storageLimit <= 0 ? t('app.cacheSizeUnlimited') : formatSize(appSettings.value.storageLimit)
)
const cacheMaxSizeDisplay = computed(() =>
  cacheSettings.value.maxSize <= 0 ? t('app.cacheSizeUnlimited') : formatSize(cacheSettings.value.maxSize)
)

// ---------- 云盘存储上限编辑模态框 ----------
const showStorageModal = ref(false)
const storageTempValue = ref(1)
const storageTempUnit = ref<StorageLimitUnit>('TB')
const storageTempUnlimited = ref(false)

function openStorageModal() {
  // 测试账号存储上限锁定
  if (isTestUser.value) {
    toast.add({ title: t('app.storageLimitLocked'), icon: 'i-lucide-lock', duration: 2500 })
    return
  }
  const limit = appSettings.value.storageLimit
  storageTempUnlimited.value = limit <= 0
  if (limit > 0) {
    const units: StorageLimitUnit[] = ['MB', 'GB', 'TB']
    let chosen: StorageLimitUnit = 'TB'
    let val = limit / STORAGE_UNIT_BYTES.TB
    for (const unit of units) {
      const v = limit / STORAGE_UNIT_BYTES[unit]
      if (v >= 1 && v < 1024) {
        chosen = unit
        val = v
        break
      }
    }
    storageTempUnit.value = chosen
    storageTempValue.value = Math.round(val * 100) / 100
  }
  showStorageModal.value = true
}

function saveStorageLimit() {
  if (storageTempUnlimited.value) {
    saveSettings({ storageLimit: 0 })
  } else {
    const bytes = STORAGE_UNIT_BYTES[storageTempUnit.value]
    const v = Number(storageTempValue.value)
    if (bytes && Number.isFinite(v) && v > 0) {
      saveSettings({ storageLimit: Math.round(v * bytes) })
    }
  }
  showStorageModal.value = false
}

// ---------- 缓存容量编辑模态框 ----------
const showCacheModal = ref(false)
const cacheTempValue = ref(1)
const cacheTempUnit = ref<CacheSizeUnit>('GB')
const cacheTempUnlimited = ref(false)

function openCacheModal() {
  const max = cacheSettings.value.maxSize
  cacheTempUnlimited.value = max <= 0
  if (max > 0) {
    const units: CacheSizeUnit[] = ['MB', 'GB', 'TB']
    let chosen: CacheSizeUnit = 'GB'
    let val = max / UNIT_BYTES.GB
    for (const unit of units) {
      const v = max / UNIT_BYTES[unit]
      if (v >= 1 && v < 1024) {
        chosen = unit
        val = v
        break
      }
    }
    cacheTempUnit.value = chosen
    cacheTempValue.value = Math.round(val * 100) / 100
  }
  showCacheModal.value = true
}

function saveCacheSize() {
  if (cacheTempUnlimited.value) {
    updateSettings({ maxSize: 0 })
  } else {
    const bytes = UNIT_BYTES[cacheTempUnit.value]
    const v = Number(cacheTempValue.value)
    if (bytes && Number.isFinite(v) && v > 0) {
      updateSettings({ maxSize: Math.round(v * bytes) })
    }
  }
  showCacheModal.value = false
}

const cacheTypeOptions = [
  { value: 'image', label: t('app.cacheTypeImage') },
  { value: 'video', label: t('app.cacheTypeVideo') },
  { value: 'audio', label: t('app.cacheTypeAudio') }
]
function toggleCacheType(value: string) {
  const types = cacheSettings.value.types.includes(value)
    ? cacheSettings.value.types.filter(t2 => t2 !== value)
    : [...cacheSettings.value.types, value]
  updateSettings({ types })
}

const clearingCache = ref(false)
async function clearCacheData() {
  clearingCache.value = true
  try {
    await clearCache()
    toast.add({ title: t('app.cacheCleared'), icon: 'i-lucide-circle-check', duration: 2500 })
  } finally {
    clearingCache.value = false
  }
}

/** 清空缓存前弹出确认模态框 */
async function openClearCacheConfirm() {
  const overlay = useOverlay()
  await overlay.create(LazyConfirmModal).open({
    title: t('app.cacheClear'),
    message: t('app.confirmClearCache'),
    icon: 'i-lucide-trash-2',
    confirmColor: 'error',
    onConfirm: async () => { await clearCacheData() }
  })
}

onMounted(() => {
  loadSettings() // 从 D1 拉取设置
  refreshStats()
})

function formatSize(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}
</script>
