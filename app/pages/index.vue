<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-950">
    <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 h-14 gap-3">
        <img src="/logo.png" alt="CloudDrive" class="h-8 w-8 rounded-lg object-cover" />
        <h1 class="text-lg font-semibold truncate flex-1">CloudDrive</h1>
        <UDropdownMenu :items="langMenuItems">
          <UButton icon="i-lucide-languages" variant="ghost" size="sm" />
        </UDropdownMenu>
        <UDropdownMenu :items="menuItems">
          <UButton icon="i-lucide-circle-user" variant="ghost" size="sm" />
        </UDropdownMenu>
      </div>
    </header>

    <!-- Breadcrumb -->
    <nav class="sticky top-14 z-9 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-2">
      <div class="flex items-center gap-1 text-sm text-gray-500 overflow-x-auto">
        <template v-for="(crumb, i) in breadcrumbs" :key="crumb.id ?? '__root__'">
          <UIcon v-if="i > 0" name="i-lucide-chevron-right" class="text-xs shrink-0" />
          <button
            class="shrink-0 truncate max-w-32 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            :class="i === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-gray-200 font-medium' : ''"
            @click="goToBreadcrumb(i)"
          >{{ crumb.name }}</button>
        </template>
      </div>
    </nav>

    <!-- Toolbar -->
    <div class="sticky top-23 z-8 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-1.5 flex justify-between gap-1">
      <!-- Search active -->
      <template v-if="showSearch">
        <div class="flex items-center gap-2 flex-1">
          <UDropdownMenu :items="searchScopeMenuItems">
            <UButton variant="outline" size="xs" class="w-32 justify-between shrink-0">
              {{ searchScopeLabel }}
              <UIcon name="i-lucide-chevron-down" class="text-xs" />
            </UButton>
          </UDropdownMenu>
          <UInput
            v-model="searchQuery"
            :placeholder="$t('app.searchPlaceholder')"
            icon="i-lucide-search"
            size="sm"
            class="flex-1"
            autofocus
          />
          <UButton icon="i-lucide-x" variant="ghost" size="sm" @click="closeSearch" />
        </div>
      </template>

      <!-- Normal toolbar -->
      <template v-else>
        <div class="flex gap-1">
          <UButton v-if="pathStack.length > 0" icon="i-lucide-arrow-left" variant="ghost" size="md" :label="$t('app.back')" @click="goBack" />
          <UButton icon="i-lucide-upload" variant="subtle" size="md" :label="$t('app.upload')" />
          <UButton icon="i-lucide-folder-plus" variant="ghost" size="md" :label="$t('app.create')" @click="showCreate = true" />
        </div>
        <div class="flex gap-1">
          <UButton icon="i-lucide-search" variant="ghost" size="md" :label="$t('app.search')" @click="showSearch = true" />
          <UDropdownMenu :items="sortMenuItems">
            <UButton icon="i-lucide-sliders-horizontal" variant="ghost" size="md" :label="$t('app.sort')" />
          </UDropdownMenu>
        </div>
      </template>
    </div>

    <main class="flex-1 overflow-auto pb-16 md:pb-0">
      <div v-if="loading || searchLoading" class="flex justify-center py-20">
        <UIcon name="i-lucide-loader-circle" class="text-3xl animate-spin text-gray-400" />
      </div>
      <div v-else-if="filteredItems.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <UIcon name="i-lucide-search" class="text-6xl mb-4" />
        <p class="text-lg">{{ $t('app.noResults') }}</p>
      </div>
      <div v-else-if="filteredItems.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <UIcon name="i-lucide-cloud-upload" class="text-6xl mb-4" />
        <p class="text-lg">{{ $t('app.emptyFolder') }}</p>
        <p class="text-sm">{{ $t('app.emptyHint') }}</p>
      </div>
      <div v-else-if="viewMode === 'grid'" class="p-2">
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <div v-for="item in filteredItems" :key="item.id" class="aspect-square rounded-lg bg-gray-50 dark:bg-gray-900 border flex flex-col items-center justify-center p-2 cursor-pointer active:scale-95 transition-transform" @click="onItemClick(item)">
            <UIcon :name="item.icon || 'i-lucide-file'" class="text-3xl" :class="item.iconColor || 'text-gray-400'" />
            <span class="text-xs mt-1 truncate w-full text-center">{{ item.name }}</span>
          </div>
        </div>
      </div>
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="item in filteredItems" :key="item.id" class="flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900" @click="onItemClick(item)">
          <UIcon :name="item.icon || 'i-lucide-file'" class="text-2xl shrink-0" :class="item.iconColor || 'text-gray-400'" />
          <div class="flex-1 min-w-0">
            <p class="text-sm truncate">{{ item.name }}</p>
            <p v-if="item.size" class="text-xs text-gray-500">{{ item.size }}</p>
          </div>
        </div>
      </div>
    </main>

    <UModal v-model:open="showCreate">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-folder-plus" class="text-lg" />
            <span class="font-semibold">{{ $t('app.newFolder') }}</span>
          </div>
          <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" @click="showCreate = false" />
        </div>
      </template>
      <template #body>
        <div class="space-y-2">
          <UInput v-model="folderName" :placeholder="$t('app.folderName')" class="w-full" :color="folderNameError ? 'error' : undefined" />
          <p v-if="folderNameError" class="text-xs text-red-500">{{ folderNameError }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="showCreate = false">{{ $t('app.cancel') }}</UButton>
          <UButton :color="canCreate ? 'primary' : 'neutral'" :variant="canCreate ? 'solid' : 'soft'" :loading="creating" :disabled="!canCreate" @click="createFolder">{{ $t('app.createFolder') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user, logout } = useAuth()
const { locale, locales, setLocale, t } = useI18n()

const items = ref<any[]>([])
const loading = ref(true)
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref<'name' | 'size' | 'type' | 'modified'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')
const currentFolderId = ref<string | null>(null)
const pathStack = ref<{ id: string, name: string }[]>([])
const breadcrumbs = computed(() => [
  { id: null, name: t('app.home') },
  ...pathStack.value,
])

const showCreate = ref(false)
const folderName = ref('')
const creating = ref(false)

// Folder name validation
const FORBIDDEN_CHARS = /[/\x00]/
const folderNameError = computed(() => {
  const name = folderName.value
  if (!name.trim()) return ''
  if (FORBIDDEN_CHARS.test(name)) return t('app.invalidChars')
  if (items.value.some((i: any) => i.type === 'folder' && i.name === name.trim())) return t('app.duplicateName')
  return ''
})
const canCreate = computed(() => folderName.value.trim() && !folderNameError.value)

// Search
const showSearch = ref(false)
const searchQuery = ref('')
const searchScope = ref<'all' | 'current' | 'sub'>('current')
const searchResults = ref<any[]>([])
const searchLoading = ref(false)

const searchScopeLabel = computed(() => ({
  all: t('app.searchAll'),
  current: t('app.searchCurrent'),
  sub: t('app.searchSub'),
}[searchScope.value]))

const searchScopeMenuItems = computed(() => [[
  { label: t('app.searchAll'), checked: searchScope.value === 'all', onSelect() { searchScope.value = 'all' } },
  { label: t('app.searchCurrent'), checked: searchScope.value === 'current', onSelect() { searchScope.value = 'current' } },
  { label: t('app.searchSub'), checked: searchScope.value === 'sub', onSelect() { searchScope.value = 'sub' } },
]])

function closeSearch() {
  showSearch.value = false
  searchQuery.value = ''
  searchResults.value = []
}

// Debounced server-side search
let searchTimer: ReturnType<typeof setTimeout>
watch([searchQuery, searchScope], () => {
  clearTimeout(searchTimer)
  const q = searchQuery.value.trim()
  if (!q || searchScope.value === 'current') {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const res = await $fetch<any>('/api/files/search', {
        query: {
          q,
          scope: searchScope.value,
          folderId: currentFolderId.value ?? '',
        },
      })
      searchResults.value = [...(res.folders || []), ...(res.files || [])].map(toItem)
    }
    catch { searchResults.value = [] }
    finally { searchLoading.value = false }
  }, 300)
})

// Unified filtered items: client-side for 'current', server-side for 'all'/'sub'
const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return items.value
  if (searchScope.value !== 'current') return searchResults.value
  return items.value.filter(item =>
    item.name.toLowerCase().includes(q),
  )
})

function fmtSize(bytes?: number) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}

const sortMenuItems = computed(() => [
  [
    { type: 'label' as const, label: t('app.viewMode') },
    { label: t('app.grid'), icon: 'i-lucide-layout-grid', checked: viewMode.value === 'grid', onSelect: () => { viewMode.value = 'grid' } },
    { label: t('app.list'), icon: 'i-lucide-list', checked: viewMode.value === 'list', onSelect: () => { viewMode.value = 'list' } },
  ],
  [
    { type: 'label' as const, label: t('app.sortBy') },
    { label: t('app.sortByName'), icon: 'i-lucide-text', checked: sortBy.value === 'name', onSelect: () => { sortBy.value = 'name' } },
    { label: t('app.sortBySize'), icon: 'i-lucide-hard-drive', checked: sortBy.value === 'size', onSelect: () => { sortBy.value = 'size' } },
    { label: t('app.sortByType'), icon: 'i-lucide-folder', checked: sortBy.value === 'type', onSelect: () => { sortBy.value = 'type' } },
    { label: t('app.sortByModified'), icon: 'i-lucide-clock', checked: sortBy.value === 'modified', onSelect: () => { sortBy.value = 'modified' } },
  ],
  [
    { type: 'label' as const, label: t('app.sortOrder') },
    { label: t('app.asc'), icon: 'i-lucide-arrow-up', checked: sortOrder.value === 'asc', onSelect: () => { sortOrder.value = 'asc' } },
    { label: t('app.desc'), icon: 'i-lucide-arrow-down', checked: sortOrder.value === 'desc', onSelect: () => { sortOrder.value = 'desc' } },
  ],
])

const langMenuItems = computed(() => {
  const name = (code: string) => locales.value.find(l => l.code === code)?.name ?? code
  return [
    [
      { label: name('zh-CN'), icon: 'i-flag:cn-4x3', type: 'checkbox' as const, checked: locale.value === 'zh-CN', onUpdateChecked() { setLocale('zh-CN') } },
      { label: name('ja'), icon: 'i-flag:jp-4x3', type: 'checkbox' as const, checked: locale.value === 'ja', onUpdateChecked() { setLocale('ja') } },
      { label: name('en'), icon: 'i-flag:us-4x3', type: 'checkbox' as const, checked: locale.value === 'en', onUpdateChecked() { setLocale('en') } },
    ],
  ]
})

const menuItems = computed(() => [
  [
    { type: 'label' as const, label: user.value?.email || t('app.notLoggedIn') },
    { type: 'label' as const, label: `${formatSize(Number(user.value?.storageUsed ?? 0))} / ${formatSize(Number(user.value?.storageLimit ?? 0))}` },
  ],
  [
    { label: t('app.settings'), icon: 'i-lucide-settings', to: '/settings' },
    { label: t('app.logout'), icon: 'i-lucide-log-out', onSelect: () => logout() },
  ],
])

function toItem(raw: any) {
  const isFile = raw.filename !== undefined
  return {
    id: raw.id,
    name: isFile ? raw.filename : raw.name,
    type: isFile ? 'file' : 'folder',
    icon: isFile ? 'i-lucide-file' : 'i-lucide-folder',
    iconColor: isFile ? 'text-gray-400' : 'text-amber-500',
    size: isFile ? formatSize(raw.size) : undefined,
  }
}

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/folders?parentId=${currentFolderId.value ?? ''}`)
    items.value = [...(res.folders || []), ...(res.files || [])].map(toItem)
  }
  catch (e) { console.error(e) }
  finally { loading.value = false }
}

function onItemClick(item: any) {
  if (item.type === 'folder') {
    currentFolderId.value = item.id
    pathStack.value.push({ id: item.id, name: item.name })
    loadData()
  }
}

function goBack() {
  pathStack.value.pop()
  currentFolderId.value = pathStack.value[pathStack.value.length - 1]?.id ?? null
  loadData()
}

function goToBreadcrumb(index: number) {
  // index 0 = 根目录, index > 0 = pathStack[index-1]
  if (index === 0) {
    pathStack.value = []
    currentFolderId.value = null
  } else if (index <= pathStack.value.length) {
    pathStack.value = pathStack.value.slice(0, index)
    currentFolderId.value = pathStack.value[index - 1]?.id ?? null
  }
  loadData()
}

async function createFolder() {
  if (!folderName.value.trim()) return
  creating.value = true
  try {
    await $fetch('/api/folders', { method: 'POST', body: { name: folderName.value, parentId: currentFolderId.value } })
    showCreate.value = false
    folderName.value = ''
    await loadData()
  }
  finally { creating.value = false }
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}
</script>
