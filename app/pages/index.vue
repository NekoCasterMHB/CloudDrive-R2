<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-950">
    <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 h-14 gap-3">
        <img src="/logo.png" alt="CloudDrive" class="h-8 w-8 rounded-lg object-cover" />
        <h1 class="text-lg font-semibold truncate flex-1">CloudDrive</h1>
        <UPopover v-model:open="showTransferPopover" :ui="{ content: 'w-80' }">
          <UButton icon="i-lucide-arrow-up-down" :label="$t('app.transfers')" :ui="{ label: 'hidden sm:inline' }" variant="subtle" size="md" :badge="activeCount || undefined" />
          <template #content>
            <div class="p-2">
              <p class="text-xs text-gray-500 font-medium px-2 py-1">{{ $t('app.recentTransfers') }}</p>
              <p class="text-[0.65rem] text-gray-400 px-2 pb-1 -mt-0.5">{{ $t('app.transfersHint') }}</p>
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
              <USeparator class="my-1" />
              <UButton variant="ghost" size="xs" block :label="$t('app.viewAll')" @click="showTransferSlideover = true" />
            </div>
          </template>
        </UPopover>
        <UButton icon="i-lucide-trash" :label="$t('app.trash')" :ui="{ label: 'hidden sm:inline' }" variant="subtle" size="md" @click="openTrash" />
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
          <template #switch-trailing="{ item }">
            <USwitch :model-value="(item as any).checked" tabindex="-1" />
          </template>
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

    <!-- 复制/剪切栏（独立于工具栏，显示在下方） -->
    <div v-if="clipboard" class="sticky top-25 z-9 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center gap-2">
      <UButton icon="i-lucide-x" variant="ghost" size="sm" :label="$t('app.cancel')" @click="clearClipboard" />
      <div class="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 px-1">
        <span v-for="ci in clipboard.items" :key="ci.id" class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 shrink-0">
          <UIcon :name="ci.icon" :class="ci.iconColor" class="shrink-0" />
          <span class="max-w-28 truncate">{{ ci.name }}</span>
        </span>
      </div>
      <UButton icon="i-lucide-clipboard-paste" variant="subtle" size="sm" :label="$t('app.paste')" @click="pasteClipboard" />
    </div>

    <main class="flex-1 overflow-auto pb-16 md:pb-0 relative" @dragenter="onMainDragEnter" @dragover="onMainDragOver" @dragleave="onMainDragLeave" @drop="onMainDrop">
      <!-- 外部拖拽上传覆盖层 -->
      <div v-if="externalDrag" class="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div class="bg-white dark:bg-gray-900 border-2 border-dashed border-blue-400 rounded-xl px-8 py-6 shadow-lg flex flex-col items-center gap-2">
          <UIcon name="i-lucide-cloud-upload" class="text-4xl text-blue-500" />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ $t('app.dropToUpload') }}</p>
          <p v-if="hoverFolderName" class="text-xs text-blue-500">{{ $t('app.dropIntoFolder', { folder: hoverFolderName }) }}</p>
        </div>
      </div>
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
      <div v-else-if="viewMode === 'grid'">
        <div ref="gridContainer" class="relative p-2 select-none" @pointerdown="onGridPointerDown" @dragover.prevent @drop.prevent>
          <div :class="['grid', gridViewClasses.cols, gridViewClasses.gap]">
            <UTooltip v-if="pathStack.length > 0" text="../">
              <div :class="['flex flex-col items-center rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform select-none gap-1', gridViewClasses.padding]" @click="goBack">
                <div :class="['w-full flex items-center justify-center overflow-hidden rounded-md', gridViewClasses.thumbHeight]">
                  <UIcon name="fluent-emoji:open-file-folder" :class="gridViewClasses.iconSize" />
                </div>
                <span :class="['leading-tight text-center text-gray-500 line-clamp-2 overflow-hidden h-[2lh] max-w-full break-all shrink-0', gridViewClasses.fontSize]">{{ '../' }}</span>
              </div>
            </UTooltip>
            <UContextMenu v-for="item in filteredItems" :key="item.id" :items="getContextMenuItems(item)">
              <UTooltip :text="item.name">
                <div
                  :data-grid-item="true"
                  :data-id="item.id"
                  draggable="true"
                  :class="[
                    'flex flex-col items-center rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform select-none gap-1',
                    gridViewClasses.padding,
                    fileSelected.has(item.id) ? 'ring-2 ring-blue-400 bg-blue-50/60 dark:bg-blue-950/30' : '',
                    isClipboardSource(item.id) ? 'opacity-40 pointer-events-none' : '',
                    dropTargetId === item.id ? 'ring-2 ring-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40' : '',
                    dragIds.includes(item.id) ? 'opacity-40' : '',
                  ]"
                  @click="onGridItemClick(item, $event)"
                  @dragstart="onGridDragStart(item, $event)"
                  @dragend="onGridDragEnd"
                  @dragover="onFolderDragOver(item, $event)"
                  @dragleave="onFolderDragLeave($event)"
                  @drop="onFolderDrop(item, $event)"
                >
                  <div :class="['w-full flex items-center justify-center overflow-hidden rounded-md', gridViewClasses.thumbHeight]">
                    <img v-if="enableThumbnails && item.isImage" :src="`/api/files/${item.id}/download`" :alt="item.name" loading="lazy" class="max-w-full max-h-full object-contain" />
                    <UIcon v-else :name="item.icon || 'i-lucide-file'" :class="[gridViewClasses.iconSize, item.iconColor || 'text-gray-400']" />
                  </div>
                  <span :class="['leading-tight text-center line-clamp-2 overflow-hidden h-[2lh] max-w-full break-all shrink-0', gridViewClasses.fontSize]">{{ item.name }}</span>
                </div>
              </UTooltip>
            </UContextMenu>
          </div>
          <!-- Rubber band 框选 -->
          <div
            v-if="rubberBand"
            class="fixed z-20 pointer-events-none border border-blue-400 bg-blue-400/20 rounded-sm"
            :style="{ left: `${rubberBand.x}px`, top: `${rubberBand.y}px`, width: `${rubberBand.w}px`, height: `${rubberBand.h}px` }"
          />
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
        <p class="text-xs text-gray-400 px-1 pb-2">{{ $t('app.transfersHint') }}</p>
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
import { LazyTrashModal, LazyConfirmModal, LazyRenameModal } from '#components'

definePageMeta({ middleware: 'auth' })

const { user, logout } = useAuth()
const { locale, locales, setLocale, t } = useI18n()
const toast = useToast()

const { items, ready, loading, loadAll, fullSync, syncItem, getChildren, getItem, upsertItem, addItem, removeItem } = useFileIndex()

// 当前目录显示列表：独立于索引 items，避免覆盖导致索引持久化损坏
const currentItems = ref<any[]>([])

function loadSetting(key: string, fallback: string): string {
  if (typeof localStorage === 'undefined') return fallback
  return localStorage.getItem(key) || fallback
}

const viewMode = ref<'grid' | 'list'>(loadSetting('view_mode', 'grid') as 'grid' | 'list')
const gridSize = ref<'sm' | 'md' | 'lg'>(loadSetting('grid_size', 'md') as 'sm' | 'md' | 'lg')
const enableThumbnails = ref(loadSetting('enable_thumbnails', 'true') === 'true')
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

watch(enableThumbnails, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('enable_thumbnails', String(val))
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
  if (currentItems.value.some((i: any) => i.type === 'folder' && i.name === name.trim())) return t('app.duplicateName')
  return ''
})
const canCreate = computed(() => folderName.value.trim() && !folderNameError.value)

// Upload
const { tasks, history, addFiles, clearDone, clearHistory, removeHistory, togglePause, cancelTask, saveHistory } = useUploader((record) => {
  if (record?.id) syncItem(record)
  loadCurrent()
}, (msg) => {
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
  const multi = fileSelected.value.size > 1
  return [
    [
      {
        label: isFolder ? t('app.open') : t('app.preview'),
        icon: isFolder ? 'i-lucide-folder' : 'i-lucide-eye',
        onSelect() { isFolder ? onItemClick(item) : previewFile(item) },
      },
    ],
    [
      { label: t('app.rename'), icon: 'i-lucide-square-pen', onSelect() { renameItem(item) } },
    ],
    [
      {
        label: multi ? t('app.copyBatch') : t('app.copy'),
        icon: 'i-lucide-copy',
        onSelect() { enterClipboard(buildClipboardItems(item), 'copy') },
      },
      {
        label: multi ? t('app.cutBatch') : t('app.cut'),
        icon: 'i-lucide-scissors',
        onSelect() { enterClipboard(buildClipboardItems(item), 'cut') },
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
async function renameItem(item: any) {
  const overlay = useOverlay()
  const newName = await overlay.create(LazyRenameModal).open({
    title: t('app.rename'),
    initialName: item.name,
    onConfirm: async (name: string) => {
      const endpoint = item.type === 'folder' ? `/api/folders/${item.id}` : `/api/files/${item.id}`
      const res = await $fetch(endpoint, { method: 'PATCH', body: { name } })
      syncItem(res)
    },
  })
  if (!newName) return
  // 若重命名的是当前所在文件夹，同步更新面包屑名称
  if (item.type === 'folder') {
    const last = pathStack.value[pathStack.value.length - 1]
    if (last && last.id === item.id) last.name = newName
  }
  loadCurrent()
  toast.add({ title: `${t('app.rename')}: ${item.name} → ${newName}`, icon: 'i-lucide-pencil', duration: 2000 })
}

function onTableSelect(_e: Event, row: any) {
  if (row.original.id === '__back__') { goBack(); return }
  onItemClick(row.original)
}

function downloadFile(item: any) {
  if (item.type !== 'file') {
    toast.add({ title: t('app.folderDownloadUnsupported'), icon: 'i-lucide-circle-x', duration: 3000 })
    return
  }
  const a = document.createElement('a')
  a.href = `/api/files/${item.id}/download?download=1`
  a.download = item.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function trashItem(item: any): Promise<void> {
  // 多选时批量删除所有选中项
  const ids = fileSelected.value.size > 1 ? Array.from(fileSelected.value) : [item.id]
  const names: string[] = []
  for (const id of ids) {
    const it = getItem(id)
    if (!it) continue
    const path = [...pathStack.value.map(p => p.name), it.name].join('/')
    try {
      await $fetch('/api/trash', {
        method: 'POST',
        body: { id, type: it.type, originalPath: path },
      })
      names.push(it.name)
      removeItem(id)
    } catch { /* 单个失败继续下一个 */ }
  }
  clearFileSelection()
  loadCurrent()
  if (names.length > 0) {
    toast.add({
      title: `${names[0]}${names.length > 1 ? ` ${t('app.andMore', { count: names.length })}` : ''} ${t('app.moveToTrash')}`,
      icon: 'i-lucide-trash-2',
      duration: 3000,
    })
  } else {
    toast.add({ title: `${t('app.moveToTrash')} ${t('app.failed')}`, color: 'error', icon: 'i-lucide-circle-x', duration: 3000 })
    throw new Error('trash failed')
  }
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

// ===== 文件网格：多选 / 框选 / 拖拽移动 / 复制剪切 =====
const fileSelected = ref<Set<string>>(new Set())
const fileSelectionCount = computed(() => fileSelected.value.size)
const dragIds = ref<string[]>([])
const dropTargetId = ref<string | null>(null)

// 复制/剪切剪贴板（进入复制剪切模式时工具栏切换）
const clipboard = ref<{ items: { id: string; type: string; name: string; icon: string; iconColor: string }[]; mode: 'copy' | 'cut' } | null>(null)

const rubberBand = ref<{ x: number; y: number; w: number; h: number } | null>(null)
let rubberStart: { x: number; y: number } | null = null
let rubberMoved = false
let rubberItemRects: { id: string; rect: DOMRect }[] = []
const gridContainer = ref<HTMLElement>()

function clearFileSelection() {
  fileSelected.value = new Set()
}

// ===== 复制 / 剪切 / 粘贴 =====
function isClipboardSource(id: string) {
  return clipboard.value?.items.some(i => i.id === id) ?? false
}

function buildClipboardItems(item: any) {
  const ids = fileSelected.value.size > 1 ? Array.from(fileSelected.value) : [item.id]
  return ids.map(id => {
    const it = getItem(id)
    return { id, type: it?.type || 'file', name: it?.name || id, icon: it?.icon || 'i-lucide-file', iconColor: it?.iconColor || 'text-gray-400' }
  })
}

function enterClipboard(items: any[], mode: 'copy' | 'cut') {
  clipboard.value = { items, mode }
  clearFileSelection()
  toast.add({
    title: mode === 'copy'
      ? `${t('app.copied')} ${items.length} ${t('app.items')}`
      : `${t('app.cut')} ${items.length} ${t('app.items')}`,
    icon: mode === 'copy' ? 'i-lucide-copy' : 'i-lucide-scissors',
    duration: 2000,
  })
}

function clearClipboard() {
  clipboard.value = null
}

async function pasteClipboard() {
  if (!clipboard.value) return
  const { items: clipItems, mode } = clipboard.value
  const payload = clipItems.map(i => ({ id: i.id, type: i.type }))
  const targetFolderId = currentFolderId.value
  try {
    if (mode === 'cut') {
      const res = await $fetch<any>('/api/move', { method: 'POST', body: { items: payload, targetFolderId } })
      for (const f of (res.files || [])) syncItem(f)
      for (const fo of (res.folders || [])) syncItem(fo)
      const movedFolderIds = new Set((res.folders || []).map((f: any) => f.id))
      const idx = pathStack.value.findIndex(p => movedFolderIds.has(p.id))
      if (idx >= 0) {
        pathStack.value = pathStack.value.slice(0, idx)
        currentFolderId.value = pathStack.value[idx - 1]?.id ?? null
      }
    } else {
      const res = await $fetch<any>('/api/copy', { method: 'POST', body: { items: payload, targetFolderId } })
      for (const f of (res.folders || [])) syncItem(f)
      for (const fo of (res.files || [])) syncItem(fo)
    }
    const names = clipItems.map(i => i.name)
    toast.add({
      title: `${mode === 'copy' ? t('app.copied') : t('app.moved')} ${names[0]}${names.length > 1 ? ` ${t('app.andMore', { count: names.length })}` : ''}`,
      icon: 'i-lucide-clipboard-paste',
      duration: 3000,
    })
    clearClipboard()
    loadCurrent()
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t('app.pasteFailed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 })
  }
}

function onGridItemClick(item: any, e: MouseEvent) {
  // Ctrl/Cmd：切换单项
  if (e.metaKey || e.ctrlKey) {
    const s = new Set(fileSelected.value)
    if (s.has(item.id)) s.delete(item.id)
    else s.add(item.id)
    fileSelected.value = s
    return
  }
  // Shift：范围选择
  if (e.shiftKey) {
    const ids = filteredItems.value.map(i => i.id)
    const cur = ids.indexOf(item.id)
    let anchor = -1
    for (let i = ids.length - 1; i >= 0; i--) {
      if (fileSelected.value.has(ids[i])) { anchor = i; break }
    }
    if (anchor >= 0 && cur >= 0) {
      const s = new Set(fileSelected.value)
      const [a, b] = anchor < cur ? [anchor, cur] : [cur, anchor]
      for (let i = a; i <= b; i++) s.add(ids[i])
      fileSelected.value = s
      return
    }
  }
  // 普通单击：单选并执行原有行为（文件夹打开 / 文件预览）
  if (item.type === 'folder') {
    // 进入文件夹后清除选择，避免选择在当前视图外悬挂
    clearFileSelection()
    onItemClick(item)
    return
  }
  fileSelected.value = new Set([item.id])
  onItemClick(item)
}

// 框选（rubber band）
function onGridPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  // 点击项内部时不启动框选（拖动项由 dragstart 处理）
  if (target.closest('[data-grid-item]')) return
  rubberStart = { x: e.clientX, y: e.clientY }
  rubberMoved = false
  rubberItemRects = Array.from(gridContainer.value?.querySelectorAll('[data-grid-item]') || []).map(el => ({
    id: el.getAttribute('data-id')!,
    rect: el.getBoundingClientRect(),
  }))
  window.addEventListener('pointermove', onRubberMove)
  window.addEventListener('pointerup', onRubberUp)
}

function onRubberMove(e: PointerEvent) {
  if (!rubberStart) return
  const dx = e.clientX - rubberStart.x
  const dy = e.clientY - rubberStart.y
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) rubberMoved = true
  if (!rubberMoved) return
  const x = Math.min(rubberStart.x, e.clientX)
  const y = Math.min(rubberStart.y, e.clientY)
  const w = Math.abs(dx)
  const h = Math.abs(dy)
  rubberBand.value = { x, y, w, h }
  const s = new Set<string>()
  for (const { id, rect } of rubberItemRects) {
    if (rect.left < x + w && rect.right > x && rect.top < y + h && rect.bottom > y) {
      s.add(id)
    }
  }
  fileSelected.value = s
}

function onRubberUp() {
  window.removeEventListener('pointermove', onRubberMove)
  window.removeEventListener('pointerup', onRubberUp)
  rubberBand.value = null
  rubberStart = null
  if (!rubberMoved) {
    // 点击空白：清除选择
    fileSelected.value = new Set()
  }
}

// ===== 外部拖拽上传（文件/文件夹拖入） =====
const externalDrag = ref(false)
const hoverFolderId = ref<string | null>(null)
const hoverFolderName = ref('')
let enterFolderTimer: ReturnType<typeof setTimeout> | null = null

// 内部拖拽（网盘内移动）的自定义标记类型，用于与外部文件拖入区分
const INTERNAL_DRAG_TYPE = 'application/x-clouddrive-items'

function isExternalDrag(e: DragEvent): boolean {
  if (!e.dataTransfer) return false
  const types = Array.from(e.dataTransfer.types)
  return types.includes('Files') && !types.includes(INTERNAL_DRAG_TYPE)
}

function clearEnterTimer() {
  if (enterFolderTimer) {
    clearTimeout(enterFolderTimer)
    enterFolderTimer = null
  }
}

function onMainDragEnter(e: DragEvent) {
  if (!isExternalDrag(e)) return
  e.preventDefault()
  externalDrag.value = true
}

function onMainDragOver(e: DragEvent) {
  if (!isExternalDrag(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onMainDragLeave(e: DragEvent) {
  if (!isExternalDrag(e)) return
  const main = e.currentTarget as HTMLElement
  const rt = e.relatedTarget as Node | null
  if (!rt || !main.contains(rt)) {
    externalDrag.value = false
    hoverFolderId.value = null
    hoverFolderName.value = ''
    clearEnterTimer()
  }
}

async function onMainDrop(e: DragEvent) {
  if (!isExternalDrag(e)) return
  e.preventDefault()
  e.stopPropagation()
  externalDrag.value = false
  hoverFolderId.value = null
  hoverFolderName.value = ''
  clearEnterTimer()
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length === 0) return
  await handleDroppedFiles(files)
}

// 拖拽移动
function onGridDragStart(item: any, e: DragEvent) {
  if (!fileSelected.value.has(item.id)) {
    fileSelected.value = new Set([item.id])
  }
  dragIds.value = Array.from(fileSelected.value)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(INTERNAL_DRAG_TYPE, dragIds.value.join(','))
    e.dataTransfer.setData('text/plain', dragIds.value.join(','))
  }
}

function onGridDragEnd() {
  dragIds.value = []
  dropTargetId.value = null
}

function onFolderDragOver(item: any, e: DragEvent) {
  // 外部文件拖入：悬停文件夹自动进入
  if (isExternalDrag(e)) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    if (item.type === 'folder' && hoverFolderId.value !== item.id) {
      hoverFolderId.value = item.id
      hoverFolderName.value = item.name
      clearEnterTimer()
      enterFolderTimer = setTimeout(() => {
        hoverFolderId.value = null
        hoverFolderName.value = ''
        clearFileSelection()
        onItemClick(item)
      }, 700)
    }
    return
  }
  // 内部拖拽移动
  if (item.type !== 'folder') return
  if (dragIds.value.includes(item.id)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropTargetId.value = item.id
}

function onFolderDragLeave(e: DragEvent) {
  dropTargetId.value = null
  if (isExternalDrag(e)) {
    const el = e.currentTarget as HTMLElement
    const rt = e.relatedTarget as Node | null
    if (!rt || !el.contains(rt)) {
      hoverFolderId.value = null
      hoverFolderName.value = ''
      clearEnterTimer()
    }
  }
}

function onFolderDrop(item: any, e: DragEvent) {
  if (isExternalDrag(e)) return // 外部拖拽上传交由 main 处理
  if (item.type !== 'folder') return
  e.preventDefault()
  e.stopPropagation()
  const ids = dragIds.value.length
    ? dragIds.value
    : (e.dataTransfer?.getData('text/plain') || '').split(',').filter(Boolean)
  onGridDragEnd()
  const valid = ids.filter(id => id !== item.id)
  if (valid.length === 0) return
  confirmMove(valid, item)
}

// 拖拽到文件夹 → 移动
function confirmMove(ids: string[], target: any) {
  confirmMoveToFolder(ids, target.id, target.name)
}

async function confirmMoveToFolder(ids: string[], targetFolderId: string | null, targetName: string) {
  const itemsPayload = ids.map(id => {
    const it = getItem(id)
    return { id, type: it?.type || 'file' }
  })
  const displayNames = ids.map(id => getItem(id)?.name).filter(Boolean)
  const overlay = useOverlay()
  await overlay.create(LazyConfirmModal).open({
    title: t('app.move'),
    message: t('app.confirmMove', { count: ids.length, target: targetName }),
    icon: 'i-lucide-folder-input',
    confirmLabel: t('app.move'),
    onConfirm: async () => {
      try {
        const res = await $fetch<any>('/api/move', {
          method: 'POST',
          body: { items: itemsPayload, targetFolderId },
        })
        for (const f of (res.files || [])) syncItem(f)
        for (const fo of (res.folders || [])) syncItem(fo)
        // 若移动的文件夹当前在路径栈中，跳转到其父级
        const movedFolderIds = new Set((res.folders || []).map((f: any) => f.id))
        const idx = pathStack.value.findIndex(p => movedFolderIds.has(p.id))
        if (idx >= 0) {
          pathStack.value = pathStack.value.slice(0, idx)
          currentFolderId.value = pathStack.value[idx - 1]?.id ?? null
        }
        clearFileSelection()
        loadCurrent()
        const first = displayNames[0] || ''
        toast.add({
          title: `${t('app.moved')} ${first}${displayNames.length > 1 ? ` ${t('app.andMore', { count: displayNames.length })}` : ''} → ${targetName}`,
          icon: 'i-lucide-folder-input',
          duration: 3000,
        })
      } catch (e: any) {
        toast.add({ title: e?.data?.message || t('app.moveFailed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 })
        throw e
      }
    },
  })
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
const showTransferPopover = ref(false)
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
    showTransferPopover.value = true
    input.value = ''
  }
}

async function handleDroppedFiles(files: File[]) {
  // 纯文件拖入（无文件夹结构）
  if (!files.some(f => f.webkitRelativePath)) {
    addFiles(files, currentFolderId.value)
    showTransferPopover.value = true
    return
  }

  // 含文件夹：构建目录树（去重所有父路径）
  const folderPaths = new Set<string>()
  for (const file of files) {
    const parts = file.webkitRelativePath.split('/')
    for (let i = 0; i < parts.length - 1; i++) {
      folderPaths.add(parts.slice(0, i + 1).join('/'))
    }
  }

  // 递归创建文件夹（父级优先）
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
      // 可能已存在，兑底为当前文件夹
      folderMap.set(path, null)
    }
  }

  // 按各自路径上传文件
  for (const file of files) {
    const folderPath = file.webkitRelativePath.split('/').slice(0, -1).join('/')
    const folderId = folderMap.get(folderPath) ?? currentFolderId.value
    // 用 basename 重建 File（webkitdirectory 的 name 是完整相对路径）
    const renamed = new File([file], file.name.split('/').pop()!, { type: file.type })
    addFiles([renamed], folderId)
  }
  showTransferPopover.value = true
  loadCurrent()
}

async function onFolderSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    await handleDroppedFiles(Array.from(input.files))
    input.value = ''
  }
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
  if (!q) return currentItems.value
  if (searchScope.value !== 'current') return searchResults.value
  return currentItems.value.filter(item =>
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
        item.isImage && enableThumbnails.value
          ? h('img', { src: `/api/files/${item.id}/download`, alt: item.name, loading: 'lazy', class: 'h-9 w-9 shrink-0 object-contain rounded' })
          : h(resolveComponent('UIcon'), { name: item.icon, class: `text-xl shrink-0 ${item.iconColor || 'text-gray-400'}` }),
        h('span', { class: 'truncate' }, item.name),
      ])
    },
  },
  {
    accessorKey: 'modified',
    header: '修改时间',
    meta: { class: { th: 'hidden md:table-cell w-[160px] text-left', td: 'hidden md:table-cell w-[160px] text-sm text-gray-500' } },
    cell: ({ row }) => {
      const ts: any = row.getValue('modified')
      if (!ts) return ''
      return new Date(ts).toLocaleString()
    },
  },
  {
    accessorKey: 'size',
    header: '文件大小',
    meta: { class: { th: 'hidden md:table-cell w-[95px] text-right', td: 'hidden md:table-cell w-[95px] text-right text-sm text-gray-500' } },
    cell: ({ row }) => row.getValue('size') || '',
  },
  {
    id: 'actions',
    header: '操作',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-11 md:w-[130px] text-right', td: 'w-11 md:w-[130px] text-right' } },
    cell: ({ row }) => {
      const item = row.original
      if (item.id === '__back__') return ''
      const items = getContextMenuItems(item)
      return h('div', { class: 'flex items-center justify-end gap-0.5' }, [
        // 重命名（移动端隐藏，md+ 显示）
        h(resolveComponent('UButton'), {
          icon: 'i-lucide-square-pen',
          class: 'hidden md:inline-flex',
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          'aria-label': t('app.rename'),
          onClick: () => renameItem(item),
        }),
        // 下载（移动端隐藏，md+ 显示）
        h(resolveComponent('UButton'), {
          icon: 'i-lucide-download',
          class: 'hidden md:inline-flex',
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          'aria-label': t('app.download'),
          onClick: () => downloadFile(item),
        }),
        // 菜单
        h(resolveComponent('UDropdownMenu'), {
          'content': { align: 'end' },
          items,
          'aria-label': 'Actions',
        }, () => h(resolveComponent('UButton'), {
          icon: 'i-lucide-ellipsis-vertical',
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          'aria-label': 'Actions',
        })),
      ])
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
    { label: t('app.small'), icon: 'i-lucide-case-lower', type: 'checkbox' as const, checked: gridSize.value === 'sm', onUpdateChecked() { gridSize.value = 'sm' } },
    { label: t('app.medium'), icon: 'i-lucide-case-sensitive', type: 'checkbox' as const, checked: gridSize.value === 'md', onUpdateChecked() { gridSize.value = 'md' } },
    { label: t('app.large'), icon: 'i-lucide-case-upper', type: 'checkbox' as const, checked: gridSize.value === 'lg', onUpdateChecked() { gridSize.value = 'lg' } },
  ],
  [
    {
      label: t('app.enableThumbnails'), icon: 'i-lucide-image', slot: 'switch' as const,
      checked: enableThumbnails.value,
      onSelect(e: Event) { e.preventDefault(); enableThumbnails.value = !enableThumbnails.value },
    },
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
    // 固定图标区高度（不依赖 aspect 比例）+ 固定图标大小 → 图标始终完整、缩略图 object-contain 完整不溢出
    thumbHeight: size === 'sm' ? 'h-10' : size === 'lg' ? 'h-24' : 'h-16',
    iconSize: size === 'sm' ? 'text-3xl' : size === 'lg' ? 'text-7xl' : 'text-5xl',
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
    { label: t('app.logout'), icon: 'i-lucide-log-out', onSelect: () => logout() },
  ],
])

function openTrash() {
  const overlay = useOverlay()
  overlay.create(LazyTrashModal).open({ onRestored: (record) => { if (record?.id) syncItem(record); loadCurrent() } })
}

function toItem(raw: any) {
  const isFile = raw.filename !== undefined
  const ext = isFile ? (raw.filename.split('.').pop()?.toLowerCase() || '') : ''
  return {
    id: raw.id,
    name: isFile ? raw.filename : raw.name,
    type: isFile ? 'file' : 'folder',
    icon: isFile ? fileIcon(raw.filename) : 'fluent-emoji:file-folder',
    iconColor: isFile ? 'text-gray-400' : 'text-amber-500',
    size: isFile ? formatSize(raw.size) : undefined,
    rawSize: isFile ? raw.size : undefined,
    modified: raw.updatedAt || raw.createdAt,
    isImage: isFile && IMAGE_EXTS.includes(ext),
  }
}

onMounted(() => loadAll().finally(loadCurrent))

async function loadCurrent() {
  currentItems.value = getChildren(currentFolderId.value)
}

function onItemClick(item: any) {
  if (item.type === 'folder') {
    currentFolderId.value = item.id
    pathStack.value.push({ id: item.id, name: item.name })
    loadCurrent()
  } else {
    previewFile(item)
  }
}

function goBack() {
  pathStack.value.pop()
  currentFolderId.value = pathStack.value[pathStack.value.length - 1]?.id ?? null
  loadCurrent()
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
  loadCurrent()
}

async function createFolder() {
  if (!folderName.value.trim()) return
  creating.value = true
  const name = folderName.value.trim()
  try {
    const folder = await $fetch<any>('/api/folders', { method: 'POST', body: { name, parentId: currentFolderId.value } })
    showCreate.value = false
    folderName.value = ''
    toast.add({ title: `${name} ${$t('app.created')}`, icon: 'i-lucide-folder-plus' })
    addItem(folder)
    loadCurrent()
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
