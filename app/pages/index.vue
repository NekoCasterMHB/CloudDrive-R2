<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-950">
    <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 h-14 gap-3">
        <img src="/logo.png" alt="CloudDrive" class="h-8 w-8 rounded-lg object-cover" />
        <h1 class="text-lg font-semibold truncate flex-1">CloudDrive</h1>
        <UPopover :ui="{ content: 'w-80' }">
          <UButton icon="i-lucide-arrow-up-down" variant="ghost" size="md" :badge="activeCount || undefined" />
          <template #content>
            <div class="p-2">
              <p class="text-xs text-gray-500 font-medium px-2 py-1">{{ $t('app.recentTransfers') }}</p>
              <div v-if="latestHistory.length === 0" class="text-sm text-gray-400 text-center py-4">{{ $t('app.noTransfers') }}</div>
              <div class="space-y-0.5">
                <div v-for="h in latestHistory" :key="h.id" class="group flex items-center gap-2 px-2 py-1.5 text-sm relative overflow-hidden rounded cursor-pointer hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500" :class="h.status === 'done' ? 'bg-green-50 dark:bg-green-950' : ''" @click="openTransferFor(h)">
                  <div v-if="'file' in h" class="absolute inset-0 bg-blue-50 dark:bg-blue-950 rounded transition-all duration-500" :style="{ width: `${h.progress}%` }" />
                  <div v-if="h.status === 'done'" class="absolute inset-0 bg-green-50 dark:bg-green-950 rounded opacity-50" />
                  <UIcon :name="h.status === 'done' ? fileIcon((h as any).fileName) : fileIcon((h as any).file?.name || '')" class="text-sm shrink-0 text-gray-400 relative" />
                  <span class="truncate flex-1 relative">{{ 'file' in h ? (h as any).file.name : (h as any).fileName }}</span>
                  <span v-if="h.status === 'uploading'" class="text-xs text-blue-500 relative">{{ h.progress.toFixed(2) }}%</span>
                  <span v-else-if="h.status === 'paused'" class="text-xs text-yellow-500 relative">{{ $t('app.paused') }}</span>
                  <span v-else class="text-xs text-gray-400 shrink-0 relative">{{ formatSize((h as any).fileSize || (h as any).file?.size) }}</span>
                  <span v-if="'file' in h" class="relative opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <UButton v-if="h.status === 'uploading'" icon="i-lucide-pause" variant="ghost" size="xs" class="text-gray-400 hover:text-yellow-500" @click.stop="togglePause(h.id)" />
                    <UButton v-if="h.status === 'paused'" icon="i-lucide-play" variant="ghost" size="xs" class="text-gray-400 hover:text-green-500" @click.stop="togglePause(h.id)" />
                  </span>
                </div>
              </div>
              <UDivider class="my-1" />
              <UButton variant="ghost" size="xs" block :label="$t('app.viewAll')" @click="showTransferSlideover = true" />
            </div>
          </template>
        </UPopover>
        <UDropdownMenu :items="langMenuItems">
          <UButton icon="i-lucide-languages" variant="ghost" size="md" />
        </UDropdownMenu>
        <UDropdownMenu :items="menuItems">
          <UButton icon="i-lucide-circle-user" variant="ghost" size="sm" />
        </UDropdownMenu>
      </div>
    </header>

    <!-- Breadcrumb + Toolbar -->
    <nav class="sticky top-14 z-9 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-1.5 flex items-center gap-2">
      <div class="flex items-center gap-1 text-sm text-gray-500 overflow-x-auto flex-1 min-w-0">
        <template v-for="(crumb, i) in breadcrumbs" :key="crumb.id ?? '__root__'">
          <UIcon v-if="i > 0" name="i-lucide-chevron-right" class="text-xs shrink-0" />
          <button
            class="shrink-0 truncate max-w-32 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            :class="i === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-gray-200 font-medium' : ''"
            @click="goToBreadcrumb(i)"
          >{{ crumb.name }}</button>
        </template>
      </div>

      <!-- Search active -->
      <template v-if="showSearch">
        <div class="flex items-center gap-2 flex-1">
          <UDropdownMenu :items="searchScopeMenuItems">
            <UButton variant="outline" size="xs" class="w-28 justify-between shrink-0">
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

      <!-- Toolbar -->
      <template v-else>
        <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 shrink-0" />
        <UButton v-if="pathStack.length > 0" icon="i-lucide-reply" variant="ghost" size="sm" @click="goBack" />
        <UButton icon="i-lucide-search" variant="ghost" size="sm" @click="showSearch = true" />
        <UDropdownMenu :items="viewMenuItems">
          <UButton icon="i-lucide-layout-grid" variant="ghost" size="sm" />
        </UDropdownMenu>
        <UDropdownMenu :items="sortMenuItems">
          <UButton icon="i-lucide-sliders-horizontal" variant="ghost" size="sm" />
        </UDropdownMenu>
        <UDropdownMenu :items="addMenuItems">
          <UButton icon="i-lucide-plus" variant="subtle" size="sm" />
        </UDropdownMenu>
        <input ref="fileInput" type="file" multiple class="hidden" @change="onFilesSelected" />
        <input ref="folderInput" type="file" webkitdirectory multiple class="hidden" @change="onFolderSelected" />
      </template>
    </nav>

    <main class="flex-1 overflow-auto pb-16 md:pb-0">
      <div v-if="loading || searchLoading" class="flex justify-center py-20">
        <UIcon name="i-lucide-loader-circle" class="text-3xl animate-spin text-gray-400" />
      </div>
      <div v-else-if="filteredItems.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <UIcon name="i-lucide-search" class="text-6xl mb-4" />
        <p class="text-lg">{{ $t('app.noResults') }}</p>
      </div>
      <div v-else-if="filteredItems.length === 0 && pathStack.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <UIcon name="i-lucide-cloud-upload" class="text-6xl mb-4" />
        <p class="text-lg">{{ $t('app.emptyFolder') }}</p>
        <p class="text-sm">{{ $t('app.emptyHint') }}</p>
      </div>
      <div v-else-if="viewMode === 'grid'" class="p-2">
        <div :class="['grid', gridViewClasses.cols, gridViewClasses.gap]">
          <UTooltip v-if="pathStack.length > 0" text="../">
            <div :class="['aspect-4/3 flex flex-col items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform select-none gap-1', gridViewClasses.padding]" @click="goBack">
              <div class="flex-1 flex items-center justify-center w-full min-h-0">
                <UIcon name="fluent-emoji:open-file-folder" :class="gridViewClasses.iconSize" />
              </div>
              <span :class="['leading-tight text-center text-gray-500 line-clamp-2 max-w-full break-all shrink-0', gridViewClasses.fontSize]">{{ '../' }}</span>
            </div>
          </UTooltip>
          <UContextMenu v-for="item in filteredItems" :key="item.id" :items="getContextMenuItems(item)">
            <UTooltip :text="item.name">
              <div :class="['aspect-4/3 flex flex-col items-center justify-center rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform select-none gap-1', gridViewClasses.padding]" @click="onItemClick(item)">
                <div class="flex-1 flex items-center justify-center w-full min-h-0">
                  <UIcon :name="item.icon || 'i-lucide-file'" :class="[gridViewClasses.iconSize, item.iconColor || 'text-gray-400']" />
                </div>
                <span :class="['leading-tight text-center line-clamp-2 max-w-full break-all shrink-0', gridViewClasses.fontSize]">{{ item.name }}</span>
              </div>
            </UTooltip>
          </UContextMenu>
        </div>
      </div>
      <div v-else>
        <UContextMenu :items="contextMenuItems">
          <UTable :data="tableData" :columns="tableColumns" class="flex-1" @select="onTableSelect" @contextmenu="onTableContextmenu" />
        </UContextMenu>
        <div v-if="filteredItems.length === 0 && pathStack.length > 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
          <UIcon name="i-lucide-cloud-upload" class="text-5xl mb-3" />
          <p class="text-base">{{ $t('app.emptyFolder') }}</p>
          <p class="text-sm">{{ $t('app.emptyHint') }}</p>
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

    <!-- Transfer Slideover -->
    <USlideover v-model:open="showTransferSlideover" :title="$t('app.transfers')">
      <template #body>
        <UTabs :items="transferTabs" v-model="transferTab" class="flex-1" :ui="{ content: 'p-0' }">
          <template #content>
            <div class="flex gap-1 px-1 py-2 border-b border-gray-100 dark:border-gray-800 items-center">
              <template v-if="selectionCount > 0">
                <span class="text-xs text-gray-500 shrink-0">{{ selectionCount }} {{ $t('app.selected') }}</span>
                <div class="flex-1" />
                <UButton variant="ghost" size="xs" icon="i-lucide-trash-2" :label="$t('app.deleteSelected')" @click="deleteSelected" />
                <UButton variant="ghost" size="xs" icon="i-lucide-x" :label="$t('app.cancel')" @click="clearSelection" />
              </template>
              <template v-else>
                <UButton :variant="transferFilter === 'all' ? 'solid' : 'ghost'" size="xs" icon="i-lucide-list" :label="$t('app.filterAll')" @click="transferFilter = 'all'" />
                <UButton :variant="transferFilter === 'upload' ? 'solid' : 'ghost'" size="xs" icon="i-lucide-upload" :label="$t('app.filterUpload')" @click="transferFilter = 'upload'" />
                <UButton :variant="transferFilter === 'download' ? 'solid' : 'ghost'" size="xs" icon="i-lucide-download" :label="$t('app.filterDownload')" @click="transferFilter = 'download'" />
                <div class="flex-1" />
                <UButton v-if="transferTab === 'completed' && history.length > 0" variant="ghost" size="xs" icon="i-lucide-trash-2" :label="$t('app.clearCompleted')" @click="clearHistory" />
              </template>
            </div>
            <div class="space-y-1 px-1 py-2">
              <template v-for="h in filteredTransferHistory" :key="h.id">
                <!-- Active tasks (have File object) -->
                <div v-if="'file' in h" class="group flex items-center gap-3 px-3 py-2.5 relative overflow-hidden rounded-lg hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 cursor-pointer select-none" :class="activeItems.has(h.id) ? 'ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30' : ''" @click="toggleActive(h.id)" @pointerdown="onPointerDown(h.id)" @pointerup="onPointerUp" @pointerleave="onPointerLeave">
                  <UIcon v-if="isMultiSelect" :name="activeItems.has(h.id) ? 'i-lucide-check-square' : 'i-lucide-square'" class="text-lg shrink-0 text-blue-500 relative" />
                  <div class="absolute inset-0 bg-blue-50 dark:bg-blue-950 rounded-lg transition-all duration-500" :style="{ width: `${h.progress}%` }" />
                  <div class="absolute inset-0 bg-yellow-50 dark:bg-yellow-950 rounded-lg transition-all duration-300" :style="{ width: `${h.progress}%` }" v-if="h.status === 'paused'" />
                  <UIcon :name="fileIcon((h as any).file.name)" class="text-lg shrink-0 text-gray-500 relative" />
                  <div class="flex-1 min-w-0 relative">
                    <p class="text-sm truncate">{{ (h as any).file.name }}</p>
                    <p class="text-xs text-gray-400">{{ formatSize((h as any).file.size * h.progress / 100) }} / {{ formatSize((h as any).file.size) }}</p>
                  </div>
                  <span v-if="h.status === 'uploading'" class="text-xs text-blue-500 relative">{{ h.progress.toFixed(2) }}%</span>
                  <span v-if="h.status === 'paused'" class="text-xs text-yellow-500 relative">{{ $t('app.paused') }}</span>
                  <div v-show="!isMultiSelect" class="relative flex items-center gap-0.5 opacity-0 sm:opacity-0 group-hover:opacity-100 transition-opacity" :class="activeItems.has(h.id) ? 'opacity-100!' : ''">
                    <UButton v-if="h.status === 'uploading'" icon="i-lucide-pause" variant="ghost" size="xs" class="text-gray-400 hover:text-yellow-500" @click.stop="togglePause(h.id)" />
                    <UButton v-if="h.status === 'paused'" icon="i-lucide-play" variant="ghost" size="xs" class="text-gray-400 hover:text-green-500" @click.stop="togglePause(h.id)" />
                    <UPopover v-model:open="deletePopoverOpen[h.id]">
                      <UButton icon="i-lucide-x" variant="ghost" size="xs" class="text-gray-400 hover:text-red-500" />
                      <template #content>
                        <div class="p-2 text-sm space-y-2 w-40">
                          <p class="text-gray-500">{{ $t('app.confirmDelete') }}</p>
                          <div class="flex gap-2 justify-end w-full">
                            <UButton color="neutral" variant="ghost" size="xs" :label="$t('app.cancel')" @click="deletePopoverOpen[h.id] = false" />
                            <UButton color="error" variant="solid" size="xs" :label="$t('app.delete')" @click="cancelTask(h.id); deletePopoverOpen[h.id] = false" />
                          </div>
                        </div>
                      </template>
                    </UPopover>
                  </div>
                </div>
                <!-- History items (stored) -->
                <div v-else class="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 cursor-pointer select-none" :class="activeItems.has(h.id) ? 'ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30' : ''" @click="toggleActive(h.id)" @pointerdown="onPointerDown(h.id)" @pointerup="onPointerUp" @pointerleave="onPointerLeave">
                  <UIcon v-if="isMultiSelect" :name="activeItems.has(h.id) ? 'i-lucide-check-square' : 'i-lucide-square'" class="text-lg shrink-0 text-blue-500 relative" />
                  <UIcon :name="fileIcon((h as any).fileName || '')" class="text-lg shrink-0" :class="h.status === 'cancelled' ? 'text-red-400' : 'text-gray-400'" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm truncate" :class="h.status === 'cancelled' ? 'line-through text-red-500' : ''">{{ (h as any).fileName }}</p>
                    <p class="text-xs" :class="h.status === 'cancelled' ? 'text-red-400' : 'text-gray-400'">{{ h.status === 'done' ? formatSize((h as any).fileSize) : (h.status === 'cancelled' ? $t('app.cancelled') : h.error) }}</p>
                  </div>
                  <span v-show="!isMultiSelect" class="relative opacity-0 sm:opacity-0 group-hover:opacity-100 transition-opacity" :class="activeItems.has(h.id) ? 'opacity-100!' : ''">
                    <UPopover v-model:open="deletePopoverOpen[(h as any).id]">
                      <UButton icon="i-lucide-trash-2" variant="ghost" size="xs" class="text-gray-400 hover:text-red-500" />
                      <template #content>
                        <div class="p-2 text-sm space-y-2 w-40">
                          <p class="text-gray-500">{{ $t('app.confirmDelete') }}</p>
                          <div class="flex gap-2 justify-end w-full">
                            <UButton color="neutral" variant="ghost" size="xs" :label="$t('app.cancel')" @click="deletePopoverOpen[(h as any).id] = false" />
                            <UButton color="error" variant="solid" size="xs" :label="$t('app.delete')" @click="removeHistory((h as any).id); deletePopoverOpen[(h as any).id] = false" />
                          </div>
                        </div>
                      </template>
                    </UPopover>
                  </span>
                </div>
              </template>
              <div v-if="filteredTransferHistory.length === 0" class="text-center text-gray-400 py-10 text-sm">{{ $t('app.noTransfers') }}</div>
            </div>
          </template>
        </UTabs>
      </template>
    </USlideover>

    <!-- File Preview -->
    <FileViewer v-if="previewFileData" :file="previewFileData.url" :file-name="previewFileData.name" :open="showPreview" @close="showPreview = false; previewFileData = null" />
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { DropdownMenuItem, TableColumn, ContextMenuItem } from '@nuxt/ui'
import { LazyTrashModal, LazyConfirmModal } from '#components'

definePageMeta({ middleware: 'auth' })

const { user, logout } = useAuth()
const { locale, locales, setLocale, t } = useI18n()
const toast = useToast()

const items = ref<any[]>([])
const loading = ref(true)

function loadSetting(key: string, fallback: string): string {
  if (typeof localStorage === 'undefined') return fallback
  return localStorage.getItem(key) || fallback
}

const viewMode = ref<'grid' | 'list'>(loadSetting('view_mode', 'grid') as 'grid' | 'list')
const displayMode = ref<'thumbnail' | 'icon'>(loadSetting('display_mode', 'icon') as 'thumbnail' | 'icon')
const gridSize = ref<'sm' | 'md' | 'lg'>(loadSetting('grid_size', 'md') as 'sm' | 'md' | 'lg')
const sortBy = ref<'name' | 'size' | 'type' | 'modified'>(loadSetting('sort_by', 'name') as 'name' | 'size' | 'type' | 'modified')
const sortOrder = ref<'asc' | 'desc'>(loadSetting('sort_order', 'asc') as 'asc' | 'desc')
const currentFolderId = ref<string | null>(loadCurrentFolderId())
const pathStack = ref<{ id: string, name: string }[]>(loadPathStack())

function loadCurrentFolderId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('current_path')
    if (!raw) return null
    const stack = JSON.parse(raw)
    return Array.isArray(stack) && stack.length > 0 ? stack[stack.length - 1].id : null
  } catch { return null }
}

function loadPathStack(): { id: string, name: string }[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem('current_path')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

watch(displayMode, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('display_mode', val)
})

watch(viewMode, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('view_mode', val)
})

watch(sortBy, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('sort_by', val)
})

watch(sortOrder, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('sort_order', val)
})

watch(gridSize, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('grid_size', val)
})

watch(pathStack, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('current_path', JSON.stringify(val))
}, { deep: true })
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

// Upload
const { tasks, history, addFiles, clearDone, clearHistory, removeHistory, togglePause, cancelTask, saveHistory } = useUploader(loadData, (msg) => {
  toast.add({ title: msg.title, color: msg.color as any, icon: msg.icon })
})
const fileInput = ref<HTMLInputElement>()
const folderInput = ref<HTMLInputElement>()
const deletePopoverOpen = ref<Record<string, boolean>>({})
const activeItems = ref<Set<string>>(new Set())
const isMultiSelect = computed(() => activeItems.value.size > 1)
const selectionCount = computed(() => activeItems.value.size)

// Context menu
async function showConfirm(title: string, message: string, icon: string, onConfirm: () => Promise<void>): Promise<void> {
  const overlay = useOverlay()
  await overlay.create(LazyConfirmModal).open({ title, message, icon, onConfirm })
}

function getContextMenuItems(item: any): ContextMenuItem[][] {
  const isFolder = item.type === 'folder'
  return [
    [
      {
        label: isFolder ? t('app.open') : t('app.preview'),
        icon: isFolder ? 'i-lucide-folder' : 'i-lucide-eye',
        onSelect() { isFolder ? onItemClick(item) : previewFile(item) },
      },
    ],
    [
      { label: t('app.copy'), icon: 'i-lucide-copy', onSelect() { copyItem(item) } },
      { label: t('app.cut'), icon: 'i-lucide-scissors', onSelect() { cutItem(item) } },
      {
        label: t('app.paste'), icon: 'i-lucide-clipboard-paste',
        onSelect() { showConfirm(t('app.paste'), t('app.confirmPaste'), 'i-lucide-clipboard-paste', () => pasteItem(item)) },
      },
    ],
    [
      {
        label: t('app.moveToTrash'), icon: 'i-lucide-trash-2', color: 'error',
        onSelect() { showConfirm(t('app.moveToTrash'), t('app.confirmTrash'), 'i-lucide-trash-2', () => trashItem(item)) },
      },
    ],
  ]
}

// Image extensions for PhotoSwipe
const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','svg','bmp','ico','avif','heic','heif','tiff','tif','raw','psd']

function previewFile(item: any) {
  const ext = item.name.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.includes(ext)) {
    previewImage(item)
  } else {
    previewFileData.value = { url: `/api/files/${item.id}/download`, name: item.name }
    showPreview.value = true
  }
}
const showPreview = ref(false)
const previewFileData = ref<{ url: string; name: string } | null>(null)

async function previewImage(item: any) {
  // Gather all images in current directory
  const allImages = filteredItems.value.filter((i: any) => {
    const ext = i.name.split('.').pop()?.toLowerCase() || ''
    return i.type === 'file' && IMAGE_EXTS.includes(ext)
  })
  const currentIndex = allImages.findIndex((i: any) => i.id === item.id)

  // Preload all images to get dimensions
  const dataSource = await Promise.all(allImages.map(async (imgItem: any) => {
    const url = `/api/files/${imgItem.id}/download`
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
    })
    return { src: url, width: img.naturalWidth, height: img.naturalHeight }
  }))

  const { default: PhotoSwipeLightbox } = await import('photoswipe/lightbox')
  await import('photoswipe/style.css')

  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    index: Math.max(0, currentIndex),
    pswpModule: () => import('photoswipe'),
  })
  lightbox.init()
  lightbox.loadAndOpen(Math.max(0, currentIndex))
  lightbox.on('close', () => { lightbox.destroy() })
}
function copyItem(item: any) {
  toast.add({ title: `${t('app.copy')}: ${item.name}`, icon: 'i-lucide-copy', duration: 2000 })
}
function cutItem(item: any) {
  toast.add({ title: `${t('app.cut')}: ${item.name}`, icon: 'i-lucide-scissors', duration: 2000 })
}
function pasteItem(item: any): Promise<void> {
  toast.add({ title: `${t('app.confirmPaste')}`, icon: 'i-lucide-clipboard-paste', duration: 2000 })
  return Promise.resolve()
}

function onTableSelect(_e: Event, row: any) {
  if (row.original.id === '__back__') { goBack(); return }
  onItemClick(row.original)
}

function trashItem(item: any): Promise<void> {
  const path = [...pathStack.value.map(p => p.name), item.name].join('/')
  return $fetch('/api/trash', {
    method: 'POST',
    body: { id: item.id, type: item.type, originalPath: path },
  }).then(() => {
    toast.add({ title: `${item.name} ${t('app.moveToTrash')}`, icon: 'i-lucide-trash-2', duration: 2000 })
    loadData()
  }).catch(() => {
    toast.add({ title: `${t('app.moveToTrash')} ${t('app.failed')}`, color: 'error', icon: 'i-lucide-circle-x', duration: 3000 })
    throw new Error('trash failed')
  })
}

function toggleActive(id: string) {
  const s = activeItems.value
  if (s.has(id)) {
    s.delete(id)
  } else if (s.size === 0) {
    s.add(id)
  } else {
    // Already has selection → enter multi-select
    s.add(id)
  }
  // Force reactivity
  activeItems.value = new Set(s)
}

// Long press → activate multi-select
let longPressTimer: ReturnType<typeof setTimeout> | null = null
function onPointerDown(id: string) {
  longPressTimer = setTimeout(() => {
    activeItems.value.add(id)
    activeItems.value = new Set(activeItems.value)
  }, 500)
}
function onPointerUp() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}
function onPointerLeave() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}

function clearSelection() {
  activeItems.value = new Set()
}

function deleteSelected() {
  const names: string[] = []
  for (const id of activeItems.value) {
    const task = tasks.value.find(t => t.id === id)
    const hist = history.value.find(h => h.id === id)
    if (task) {
      names.push(task.file.name)
      const idx = tasks.value.findIndex(t => t.id === id)
      if (idx !== -1) {
        const t = tasks.value[idx]!
        tasks.value.splice(idx, 1)
        history.value.unshift({ id: t.id, fileName: t.file.name, fileSize: t.file.size, folderId: t.folderId, type: t.type, status: 'cancelled', time: Date.now() })
        if (history.value.length > 100) history.value.pop()
      }
    }
    if (hist) {
      names.push(hist.fileName)
      history.value = history.value.filter(h => h.id !== id)
    }
  }
  saveHistory()
  clearSelection()
  const first = names[0] || ''
  toast.add({ title: `${t('app.deleted')} ${first}${names.length > 1 ? ` ${t('app.andMore', { count: names.length })}` : ''}`, icon: 'i-lucide-circle-check', duration: 3000 })
}

// Transfer slideover
const showTransferSlideover = ref(false)
const transferTab = ref('uploading')
const transferFilter = ref<'all' | 'upload' | 'download'>('all')
const activeCount = computed(() => tasks.value.filter(t => t.status === 'pending' || t.status === 'uploading').length)
const historyCount = computed(() => history.value.length)
const latestHistory = computed(() => {
  // Most recent 5: active tasks first, then history sorted by time
  const active = tasks.value.filter(t => t.status === 'uploading' || t.status === 'paused')
  const done = history.value.slice()
  const all = [...active, ...done]
  all.sort((a, b) => ((b as any).time || 0) - ((a as any).time || 0))
  return all.slice(0, 5)
})
const transferTabs = computed(() => [
  { label: `${$t('app.uploading')} (${activeCount.value})`, icon: 'i-lucide-arrow-up-down', value: 'uploading' },
  { label: `${$t('app.completed')} (${historyCount.value})`, icon: 'i-lucide-circle-check', value: 'completed' },
])
const filteredTransferHistory = computed(() => {
  const filter = transferFilter.value
  if (transferTab.value === 'uploading') {
    return tasks.value.filter(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'paused')
      .filter(t => filter === 'all' || t.type === filter)
  }
  return history.value.filter(h => filter === 'all' || h.type === filter)
})

function triggerUpload() {
  fileInput.value?.click()
}

function openTransferFor(h: any) {
  transferTab.value = 'file' in h ? 'uploading' : 'completed'
  showTransferSlideover.value = true
}

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    addFiles(Array.from(input.files), currentFolderId.value)
    input.value = ''
  }
}

async function onFolderSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return

  // Build folder tree: unique folder paths
  const folderPaths = new Set<string>()
  for (const file of files) {
    const parts = file.webkitRelativePath.split('/')
    for (let i = 0; i < parts.length - 1; i++) {
      folderPaths.add(parts.slice(0, i + 1).join('/'))
    }
  }

  // Create folders recursively
  const folderMap = new Map<string, string | null>() // path → folderId
  folderMap.set('', currentFolderId.value)

  for (const path of [...folderPaths].sort()) {
    const parentPath = path.split('/').slice(0, -1).join('/')
    const parentId = folderMap.get(parentPath) ?? null
    const name = path.split('/').pop()!
    try {
      const res = await $fetch<any>('/api/folders', {
        method: 'POST',
        body: { name, parentId },
      })
      folderMap.set(path, res.id)
    } catch {
      // Maybe duplicate, fetch existing
      folderMap.set(path, null)
    }
  }

  // Upload files into their respective folders
  for (const file of files) {
    const folderPath = file.webkitRelativePath.split('/').slice(0, -1).join('/')
    const folderId = folderMap.get(folderPath) ?? currentFolderId.value
    // Create a new File with just the basename (webkitdirectory gives full relative path as name)
    const renamed = new File([file], file.name.split('/').pop()!, { type: file.type })
    addFiles([renamed], folderId)
  }
  input.value = ''
}

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

const tableData = computed(() => {
  const backItem = pathStack.value.length > 0
    ? [{ id: '__back__', name: '../', type: 'folder', icon: 'fluent-emoji:open-file-folder', iconColor: 'text-amber-500', size: undefined, rawSize: undefined, modified: undefined }]
    : []
  return [...backItem, ...filteredItems.value]
})

function fmtSize(bytes?: number) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}

const contextItem = ref<any>(null)
const contextMenuItems = ref<ContextMenuItem[][]>([])

function onTableContextmenu(_e: Event, row: any) {
  if (row.original.id === '__back__') { contextMenuItems.value = []; return }
  contextItem.value = row.original
  contextMenuItems.value = getContextMenuItems(row.original)
}

const tableColumns: TableColumn<any>[] = [
  {
    accessorKey: 'name',
    header: '文件名',
    minSize: 200,
    meta: { class: { td: 'truncate max-w-0 w-full' } },
    cell: ({ row }) => {
      const item = row.original
      return h('div', { class: 'flex items-center gap-2 truncate' }, [
        h(resolveComponent('UIcon'), { name: item.icon, class: `text-xl shrink-0 ${item.iconColor || 'text-gray-400'}` }),
        h('span', { class: 'truncate' }, item.name),
      ])
    },
  },
  {
    accessorKey: 'modified',
    header: '修改时间',
    meta: { class: { th: 'w-[160px] text-left', td: 'w-[160px] text-sm text-gray-500' } },
    cell: ({ row }) => {
      const ts: any = row.getValue('modified')
      if (!ts) return ''
      return new Date(ts).toLocaleString()
    },
  },
  {
    accessorKey: 'size',
    header: '文件大小',
    meta: { class: { th: 'w-[95px] text-right', td: 'w-[95px] text-right text-sm text-gray-500' } },
    cell: ({ row }) => row.getValue('size') || '',
  },
  {
    id: 'actions',
    header: '操作',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-[95px] text-right', td: 'w-[95px] text-right' } },
    cell: ({ row }) => {
      const items = getContextMenuItems(row.original)
      return h(resolveComponent('UDropdownMenu'), {
        'content': { align: 'end' },
        items,
        'aria-label': 'Actions',
      }, () => h(resolveComponent('UButton'), {
        icon: 'i-lucide-ellipsis-vertical',
        color: 'neutral',
        variant: 'ghost',
        size: 'sm',
        'aria-label': 'Actions',
      }))
    },
  },
]

const viewMenuItems = computed((): DropdownMenuItem[][] => [
  [
    { type: 'label' as const, label: t('app.viewMode') },
    { label: t('app.grid'), icon: 'i-lucide-layout-grid', type: 'checkbox' as const, checked: viewMode.value === 'grid', onUpdateChecked() { viewMode.value = 'grid' } },
    { label: t('app.list'), icon: 'i-lucide-list', type: 'checkbox' as const, checked: viewMode.value === 'list', onUpdateChecked() { viewMode.value = 'list' } },
  ],
  [
    { type: 'label' as const, label: t('app.display') },
    { label: t('app.thumbnail'), icon: 'i-lucide-image', type: 'checkbox' as const, checked: displayMode.value === 'thumbnail', onUpdateChecked() { displayMode.value = 'thumbnail' } },
    { label: t('app.icon'), icon: 'i-lucide-file-type', type: 'checkbox' as const, checked: displayMode.value === 'icon', onUpdateChecked() { displayMode.value = 'icon' } },
    { label: t('app.small'), icon: 'i-lucide-case-lower', type: 'checkbox' as const, checked: gridSize.value === 'sm', onUpdateChecked() { gridSize.value = 'sm' } },
    { label: t('app.medium'), icon: 'i-lucide-case-sensitive', type: 'checkbox' as const, checked: gridSize.value === 'md', onUpdateChecked() { gridSize.value = 'md' } },
    { label: t('app.large'), icon: 'i-lucide-case-upper', type: 'checkbox' as const, checked: gridSize.value === 'lg', onUpdateChecked() { gridSize.value = 'lg' } },
  ],
])

const sortMenuItems = computed((): DropdownMenuItem[][] => [
  [
    { type: 'label' as const, label: t('app.sortBy') },
    { label: t('app.sortByName'), icon: 'i-lucide-a-large-small', type: 'checkbox' as const, checked: sortBy.value === 'name', onUpdateChecked() { sortBy.value = 'name' } },
    { label: t('app.sortBySize'), icon: 'i-lucide-server', type: 'checkbox' as const, checked: sortBy.value === 'size', onUpdateChecked() { sortBy.value = 'size' } },
    { label: t('app.sortByType'), icon: 'i-lucide-file-type', type: 'checkbox' as const, checked: sortBy.value === 'type', onUpdateChecked() { sortBy.value = 'type' } },
    { label: t('app.sortByModified'), icon: 'i-lucide-history', type: 'checkbox' as const, checked: sortBy.value === 'modified', onUpdateChecked() { sortBy.value = 'modified' } },
  ],
  [
    { label: t('app.asc'), icon: 'i-lucide-arrow-down-a-z', type: 'checkbox' as const, checked: sortOrder.value === 'asc', onUpdateChecked() { sortOrder.value = 'asc' } },
    { label: t('app.desc'), icon: 'i-lucide-arrow-up-a-z', type: 'checkbox' as const, checked: sortOrder.value === 'desc', onUpdateChecked() { sortOrder.value = 'desc' } },
  ],
])

const gridViewClasses = computed(() => {
  const size = gridSize.value
  return {
    iconSize: size === 'sm' ? 'text-[3rem]' : size === 'lg' ? 'text-[7rem]' : 'text-[5rem]',
    fontSize: size === 'sm' ? 'text-[0.65rem]' : size === 'lg' ? 'text-[0.85rem]' : 'text-[0.75rem]',
    padding: size === 'sm' ? 'p-1' : size === 'lg' ? 'p-2.5' : 'p-2',
    cols: size === 'sm'
      ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'
      : size === 'lg'
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7'
        : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9',
    gap: size === 'sm' ? 'gap-0.5' : size === 'lg' ? 'gap-3' : 'gap-2',
  }
})

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

const addMenuItems = computed(() => [
  [
    { label: t('app.upload'), icon: 'i-lucide-upload', onSelect() { fileInput.value?.click() } },
    { label: t('app.uploadFolder'), icon: 'i-lucide-folder-input', onSelect() { folderInput.value?.click() } },
    { label: t('app.create'), icon: 'i-lucide-folder-plus', onSelect() { showCreate.value = true } },
  ],
])

const menuItems = computed(() => [
  [
    { type: 'label' as const, label: user.value?.email || t('app.notLoggedIn') },
    { type: 'label' as const, label: `${formatSize(Number(user.value?.storageUsed ?? 0))} / ${formatSize(Number(user.value?.storageLimit ?? 0))}` },
  ],
  [
    { label: t('app.settings'), icon: 'i-lucide-settings', to: '/settings' },
    { label: t('app.trash'), icon: 'i-lucide-trash-2', onSelect: async () => {
      const overlay = useOverlay()
      await overlay.create(LazyTrashModal).open({ onRestored: () => loadData() })
      loadData()
    } },
    { label: t('app.logout'), icon: 'i-lucide-log-out', onSelect: () => logout() },
  ],
])

function toItem(raw: any) {
  const isFile = raw.filename !== undefined
  return {
    id: raw.id,
    name: isFile ? raw.filename : raw.name,
    type: isFile ? 'file' : 'folder',
    icon: isFile ? fileIcon(raw.filename) : 'fluent-emoji:file-folder',
    iconColor: isFile ? 'text-gray-400' : 'text-amber-500',
    size: isFile ? formatSize(raw.size) : undefined,
    rawSize: isFile ? raw.size : undefined,
    modified: raw.updatedAt || raw.createdAt,
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
  } else {
    previewFile(item)
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
  const name = folderName.value.trim()
  try {
    await $fetch('/api/folders', { method: 'POST', body: { name, parentId: currentFolderId.value } })
    showCreate.value = false
    folderName.value = ''
    toast.add({ title: `${name} ${$t('app.created')}`, icon: 'i-lucide-folder-plus' })
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
