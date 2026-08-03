<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-950">
    <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 h-14 gap-3">
        <img
          src="/logo.png"
          alt="CloudDrive"
          class="h-8 w-8 rounded-lg object-cover"
        >
        <h1 class="text-lg font-semibold truncate flex-1">
          CloudDrive
        </h1>
        <UPopover
          v-model:open="showTransferPopover"
          :ui="{ content: 'w-80' }"
        >
          <div class="relative">
            <UButton
              :icon="activeCount > 0 ? 'i-lucide-loader-circle' : 'i-lucide-arrow-up-down'"
              :label="$t('app.transfers')"
              :ui="{ label: 'hidden sm:inline', leadingIcon: activeCount > 0 ? 'animate-spin' : '' }"
              variant="subtle"
              size="md"
            />
            <UBadge
              v-if="activeCount > 0"
              :label="String(activeCount)"
              color="error"
              size="sm"
              class="absolute -top-1.5 -right-1.5 pointer-events-none"
            />
          </div>
          <template #content>
            <div class="p-2">
              <p class="text-xs text-gray-500 font-medium px-2 py-1">
                {{ $t('app.recentTransfers') }}
              </p>
              <p class="text-[0.65rem] text-gray-400 px-2 pb-1 -mt-0.5">
                {{ $t('app.transfersHint') }}
              </p>
              <div
                v-if="latestHistory.length === 0"
                class="text-sm text-gray-400 text-center py-4"
              >
                {{ $t('app.noTransfers') }}
              </div>
              <div class="space-y-0.5">
                <div
                  v-for="item in latestHistory"
                  :key="item.id"
                  class="group flex items-center gap-2 px-2 py-1.5 text-sm relative overflow-hidden rounded cursor-pointer hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500"
                  :class="item.status === 'done' ? 'bg-green-50 dark:bg-green-950' : ''"
                  @click="openTransferFor(item)"
                >
                  <div
                    v-if="'file' in item"
                    class="absolute inset-0 bg-blue-50 dark:bg-blue-950 rounded transition-all duration-500"
                    :style="{ width: `${item.progress}%` }"
                  />
                  <div
                    v-if="item.status === 'done'"
                    class="absolute inset-0 bg-green-50 dark:bg-green-950 rounded opacity-50"
                  />
                  <UIcon
                    :name="item.status === 'done' ? fileIcon((item as any).fileName) : fileIcon((item as any).file?.name || '')"
                    class="text-sm shrink-0 text-gray-400 relative"
                  />
                  <span class="truncate flex-1 relative">{{ 'file' in item ? (item as any).file.name : (item as any).fileName }}</span>
                  <span
                    v-if="item.status === 'uploading'"
                    class="text-xs text-blue-500 relative"
                  >{{ item.progress.toFixed(2) }}%</span>
                  <span
                    v-else-if="item.status === 'paused'"
                    class="text-xs text-yellow-500 relative"
                  >{{ $t('app.paused') }}</span>
                  <span
                    v-else
                    class="text-xs text-gray-400 shrink-0 relative"
                  >{{ formatSize((item as any).fileSize || (item as any).file?.size) }}</span>
                  <span
                    v-if="'file' in item"
                    class="relative opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <UButton
                      v-if="item.status === 'uploading'"
                      icon="i-lucide-pause"
                      variant="ghost"
                      size="xs"
                      class="text-gray-400 hover:text-yellow-500"
                      @click.stop="togglePause(item.id)"
                    />
                    <UButton
                      v-if="item.status === 'paused'"
                      icon="i-lucide-play"
                      variant="ghost"
                      size="xs"
                      class="text-gray-400 hover:text-green-500"
                      @click.stop="togglePause(item.id)"
                    />
                  </span>
                </div>
              </div>
              <USeparator class="my-1" />
              <UButton
                variant="ghost"
                size="xs"
                block
                :label="$t('app.viewAll')"
                @click="showTransferSlideover = true"
              />
            </div>
          </template>
        </UPopover>
        <UButton
          icon="i-lucide-trash-2"
          :label="$t('app.trash')"
          :ui="{ label: 'hidden sm:inline' }"
          variant="subtle"
          size="md"
          @click="openTrash"
        />
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
                <span class="flex-1 min-w-0">{{ formatSize(user?.storageUsed ?? 0) }} / {{ (user?.storageLimit ?? 0) <= 0 ? $t('app.cacheSizeUnlimited') : formatSize(user?.storageLimit ?? 0) }}</span>
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

    <!-- Breadcrumb + Toolbar -->
    <nav class="sticky top-14 z-9 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-1.5 flex items-center gap-2">
      <div class="flex items-center gap-1 text-sm text-gray-500 overflow-x-auto flex-1 min-w-0">
        <template
          v-for="(crumb, i) in breadcrumbs"
          :key="crumb.id ?? '__root__'"
        >
          <UIcon
            v-if="i > 0"
            name="i-lucide-chevron-right"
            class="text-xs shrink-0"
          />
          <button
            class="shrink-0 truncate max-w-32 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            :class="i === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-gray-200 font-medium' : ''"
            @click="goToBreadcrumb(i)"
          >
            {{ crumb.name }}
          </button>
        </template>
      </div>

      <!-- Search active -->
      <template v-if="showSearch">
        <div class="flex items-center gap-2 flex-1">
          <UDropdownMenu :items="searchScopeMenuItems">
            <UButton
              variant="outline"
              size="xs"
              class="w-28 justify-between shrink-0"
            >
              {{ searchScopeLabel }}
              <UIcon
                name="i-lucide-chevron-down"
                class="text-xs"
              />
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
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            size="sm"
            @click="closeSearch"
          />
        </div>
      </template>

      <!-- Toolbar -->
      <template v-else>
        <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 shrink-0" />
        <UButton
          v-if="pathStack.length > 0"
          icon="i-lucide-reply"
          variant="ghost"
          size="sm"
          @click="goBack"
        />
        <UButton
          icon="i-lucide-search"
          variant="ghost"
          size="sm"
          @click="showSearch = true"
        />
        <UDropdownMenu :items="viewMenuItems">
          <UButton
            icon="i-lucide-layout-grid"
            variant="ghost"
            size="sm"
          />
          <template #switch-trailing="{ item }">
            <USwitch
              :model-value="(item as any).checked"
              tabindex="-1"
            />
          </template>
        </UDropdownMenu>
        <UDropdownMenu :items="sortMenuItems">
          <UButton
            icon="i-lucide-sliders-horizontal"
            variant="ghost"
            size="sm"
          />
        </UDropdownMenu>
        <UDropdownMenu :items="addMenuItems">
          <UButton
            icon="i-lucide-plus"
            variant="subtle"
            size="sm"
          />
        </UDropdownMenu>
        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          @change="onFilesSelected"
        >
        <input
          ref="folderInput"
          type="file"
          webkitdirectory
          multiple
          class="hidden"
          @change="onFolderSelected"
        >
      </template>
    </nav>

    <!-- 复制/剪切栏（独立于工具栏，显示在下方） -->
    <div
      v-if="clipboard"
      class="sticky top-25 z-9 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center gap-2"
    >
      <UButton
        icon="i-lucide-x"
        variant="ghost"
        size="sm"
        :label="$t('app.cancel')"
        @click="clearClipboard"
      />
      <div class="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 px-1">
        <span
          v-for="ci in clipboard.items"
          :key="ci.id"
          class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 shrink-0"
        >
          <UIcon
            :name="ci.icon"
            :class="ci.iconColor"
            class="shrink-0"
          />
          <span class="max-w-28 truncate">{{ ci.name }}</span>
        </span>
      </div>
      <UButton
        icon="i-lucide-clipboard-paste"
        variant="subtle"
        size="sm"
        :label="$t('app.paste')"
        @click="pasteClipboard"
      />
    </div>

    <main
      class="flex-1 overflow-auto pb-16 md:pb-0 relative"
      :class="{ 'select-none': rubberDragging }"
      @pointerdown="onGridPointerDown"
      @dragenter="onMainDragEnter"
      @dragover="onMainDragOver"
      @dragleave="onMainDragLeave"
      @drop="onMainDrop"
    >
      <!-- 外部拖拽上传覆盖层 -->
      <div
        v-if="externalDrag"
        class="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
      >
        <div class="bg-white dark:bg-gray-900 border-2 border-dashed border-blue-400 rounded-xl px-8 py-6 shadow-lg flex flex-col items-center gap-2">
          <UIcon
            name="i-lucide-cloud-upload"
            class="text-4xl text-blue-500"
          />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ $t('app.dropToUpload') }}
          </p>
          <p
            v-if="hoverFolderName"
            class="text-xs text-blue-500"
          >
            {{ $t('app.dropIntoFolder', { folder: hoverFolderName }) }}
          </p>
        </div>
      </div>
      <div
        v-if="loading || searchLoading"
        class="flex justify-center py-20"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="text-3xl animate-spin text-gray-400"
        />
      </div>
      <div
        v-else-if="filteredItems.length === 0 && searchQuery"
        class="flex flex-col items-center justify-center py-20 text-gray-400"
      >
        <UIcon
          name="i-lucide-search"
          class="text-6xl mb-4"
        />
        <p class="text-lg">
          {{ $t('app.noResults') }}
        </p>
      </div>
      <div
        v-else-if="filteredItems.length === 0 && pathStack.length === 0"
        class="flex flex-col items-center justify-center py-20 text-gray-400"
      >
        <UIcon
          name="i-lucide-cloud-upload"
          class="text-6xl mb-4"
        />
        <p class="text-lg">
          {{ $t('app.emptyFolder') }}
        </p>
        <p class="text-sm">
          {{ $t('app.emptyHint') }}
        </p>
      </div>
      <div v-else-if="viewMode === 'grid'">
        <div
          ref="gridContainer"
          class="relative p-3 select-none"
          @dragover.prevent
          @drop.prevent
        >
          <div :class="['grid', gridViewClasses.cols, gridViewClasses.gap]">
            <UTooltip
              v-if="pathStack.length > 0"
              text="../"
            >
              <div
                data-rubber-ignore
                :class="['flex flex-col items-center rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform select-none gap-1', gridViewClasses.padding]"
                @click="goBack"
              >
                <div :class="['w-full flex items-center justify-center overflow-hidden rounded-md', gridViewClasses.thumbHeight]">
                  <UIcon
                    name="fluent-emoji:open-file-folder"
                    :class="gridViewClasses.iconSize"
                  />
                </div>
                <span :class="['leading-tight text-center text-gray-500 line-clamp-2 overflow-hidden h-[2lh] max-w-full break-all shrink-0', gridViewClasses.fontSize]">{{ '../' }}</span>
              </div>
            </UTooltip>
            <UContextMenu
              v-for="item in filteredItems"
              :key="item.id"
              :items="getContextMenuItems(item)"
            >
              <template #content-top>
                <MenuFileHeader
                  :item="item"
                  :selected-count="fileSelected.size"
                  :get-children="getChildren"
                />
              </template>
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
                    dragIds.includes(item.id) ? 'opacity-40' : ''
                  ]"
                  @click="onGridItemClick(item, $event)"
                  @dragstart="onGridDragStart(item, $event)"
                  @dragend="onGridDragEnd"
                  @dragover="onFolderDragOver(item, $event)"
                  @dragleave="onFolderDragLeave($event)"
                  @drop="onFolderDrop(item, $event)"
                >
                  <div :class="['w-full flex items-center justify-center overflow-hidden rounded-md', gridViewClasses.thumbHeight]">
                    <CachedImage
                      v-if="enableThumbnails && item.isImage"
                      :id="item.id"
                      :src="`/api/files/${item.id}/download`"
                      :alt="item.name"
                      :content-type="item.contentType"
                      loading="lazy"
                      class="max-w-full max-h-full object-contain"
                    />
                    <VideoThumbnail
                      v-else-if="enableThumbnails && isVideoFile(item)"
                      :id="item.id"
                      :src="`/api/files/${item.id}/download`"
                      :alt="item.name"
                      :content-type="item.contentType"
                      loading="lazy"
                      class="w-full h-full max-w-full max-h-full"
                    />
                    <UIcon
                      v-else
                      :name="item.icon || 'i-lucide-file'"
                      :class="[gridViewClasses.iconSize, item.iconColor || 'text-gray-400']"
                    />
                  </div>
                  <span :class="['leading-tight text-center line-clamp-2 overflow-hidden h-[2lh] max-w-full break-all shrink-0', gridViewClasses.fontSize]">{{ item.name }}</span>
                </div>
              </UTooltip>
            </UContextMenu>
          </div>
        </div>
      </div>
      <div v-else>
        <UContextMenu :items="contextMenuItems">
          <template #content-top>
            <MenuFileHeader
              v-if="contextItem"
              :item="contextItem"
              :selected-count="fileSelected.size"
              :get-children="getChildren"
            />
          </template>
          <UTable
            v-model:row-selection="rowSelection"
            :data="tableData"
            :columns="tableColumns"
            :meta="tableMeta"
            :get-row-id="rowIdGetter"
            class="flex-1"
            @select="onTableSelect"
            @contextmenu="onTableContextmenu"
          />
        </UContextMenu>
        <div
          v-if="filteredItems.length === 0 && pathStack.length > 0"
          class="flex flex-col items-center justify-center py-16 text-gray-400"
        >
          <UIcon
            name="i-lucide-cloud-upload"
            class="text-5xl mb-3"
          />
          <p class="text-base">
            {{ $t('app.emptyFolder') }}
          </p>
          <p class="text-sm">
            {{ $t('app.emptyHint') }}
          </p>
        </div>
      </div>
      <!-- Rubber band 框选（宫格 + 列表通用，fixed 定位） -->
      <div
        v-if="rubberBand"
        class="fixed z-20 pointer-events-none border border-blue-400 bg-blue-400/20 rounded-sm"
        :style="{ left: `${rubberBand.x}px`, top: `${rubberBand.y}px`, width: `${rubberBand.w}px`, height: `${rubberBand.h}px` }"
      />
      <!-- 多选操作栏（长按 / 复选框 / 框选选中后显示） -->
      <div
        v-if="fileSelected.size > 0"
        class="fixed bottom-4 inset-x-0 z-50 flex justify-center pointer-events-none"
      >
        <div class="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 shadow-xl px-3 py-2">
          <span class="text-sm font-medium px-1 shrink-0">{{ fileSelected.size }}{{ $t('app.selected') }}</span>
          <UButton size="sm" color="primary" variant="soft" :label="$t('app.moveTo')" icon="i-lucide-folder-input" @click="openMovePicker" />
          <UButton size="sm" color="error" variant="soft" :label="$t('app.moveToTrash')" icon="i-lucide-trash-2" @click="deleteMultiSelected" />
          <UButton size="sm" variant="ghost" :label="$t('app.cancel')" @click="exitMobileSelect" />
        </div>
      </div>
    </main>

    <UModal v-model:open="showCreate">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-folder-plus"
              class="text-lg"
            />
            <span class="font-semibold">{{ $t('app.newFolder') }}</span>
          </div>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="showCreate = false"
          />
        </div>
      </template>
      <template #body>
        <div class="space-y-2">
          <UInput
            v-model="folderName"
            :placeholder="$t('app.folderName')"
            class="w-full"
            :color="folderNameError ? 'error' : undefined"
          />
          <p
            v-if="folderNameError"
            class="text-xs text-red-500"
          >
            {{ folderNameError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showCreate = false"
          >
            {{ $t('app.cancel') }}
          </UButton>
          <UButton
            :color="canCreate ? 'primary' : 'neutral'"
            :variant="canCreate ? 'solid' : 'soft'"
            :loading="creating"
            :disabled="!canCreate"
            @click="createFolder"
          >
            {{ $t('app.createFolder') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Transfer Slideover -->
    <USlideover
      v-model:open="showTransferSlideover"
      :title="$t('app.transfers')"
    >
      <template #body>
        <p class="text-xs text-gray-400 px-1 pb-2">
          {{ $t('app.transfersHint') }}
        </p>
        <UTabs
          v-model="transferTab"
          :items="transferTabs"
          class="flex-1"
          :ui="{ content: 'p-0' }"
        >
          <template #content>
            <div class="flex gap-1 px-1 py-2 border-b border-gray-100 dark:border-gray-800 items-center">
              <template v-if="selectionCount > 0">
                <span class="text-xs text-gray-500 shrink-0">{{ selectionCount }} {{ $t('app.selected') }}</span>
                <div class="flex-1" />
                <UButton
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  :label="$t('app.deleteSelected')"
                  @click="deleteSelected"
                />
                <UButton
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-x"
                  :label="$t('app.cancel')"
                  @click="clearSelection"
                />
              </template>
              <template v-else>
                <UButton
                  :variant="transferFilter === 'all' ? 'solid' : 'ghost'"
                  size="xs"
                  icon="i-lucide-list"
                  :label="$t('app.filterAll')"
                  @click="transferFilter = 'all'"
                />
                <UButton
                  :variant="transferFilter === 'upload' ? 'solid' : 'ghost'"
                  size="xs"
                  icon="i-lucide-upload"
                  :label="$t('app.filterUpload')"
                  @click="transferFilter = 'upload'"
                />
                <UButton
                  :variant="transferFilter === 'download' ? 'solid' : 'ghost'"
                  size="xs"
                  icon="i-lucide-download"
                  :label="$t('app.filterDownload')"
                  @click="transferFilter = 'download'"
                />
                <div class="flex-1" />
                <UButton
                  v-if="transferTab === 'completed' && history.length > 0"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  :label="$t('app.clearCompleted')"
                  @click="clearHistory"
                />
              </template>
            </div>
            <div class="space-y-1 px-1 py-2">
              <template
                v-for="item in filteredTransferHistory"
                :key="item.id"
              >
                <!-- Active tasks (have File object) -->
                <div
                  v-if="'file' in item"
                  class="group flex items-center gap-3 px-3 py-2.5 relative overflow-hidden rounded-lg hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 cursor-pointer select-none"
                  :class="activeItems.has(item.id) ? 'ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30' : ''"
                  @click="toggleActive(item.id)"
                  @pointerdown="onPointerDown(item.id)"
                  @pointerup="onPointerUp"
                  @pointerleave="onPointerLeave"
                >
                  <UIcon
                    v-if="isMultiSelect"
                    :name="activeItems.has(item.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
                    class="text-lg shrink-0 text-blue-500 relative"
                  />
                  <div
                    class="absolute inset-0 bg-blue-50 dark:bg-blue-950 rounded-lg transition-all duration-500"
                    :style="{ width: `${item.progress}%` }"
                  />
                  <div
                    v-if="item.status === 'paused'"
                    class="absolute inset-0 bg-yellow-50 dark:bg-yellow-950 rounded-lg transition-all duration-300"
                    :style="{ width: `${item.progress}%` }"
                  />
                  <UIcon
                    :name="fileIcon((item as any).file.name)"
                    class="text-lg shrink-0 text-gray-500 relative"
                  />
                  <div class="flex-1 min-w-0 relative">
                    <p class="text-sm truncate">
                      {{ (item as any).file.name }}
                    </p>
                    <p class="text-xs text-gray-400">
                      {{ formatSize((item as any).file.size * item.progress / 100) }} / {{ formatSize((item as any).file.size) }}
                    </p>
                  </div>
                  <span
                    v-if="item.status === 'uploading'"
                    class="text-xs text-blue-500 relative"
                  >{{ item.progress.toFixed(2) }}%</span>
                  <span
                    v-if="item.status === 'paused'"
                    class="text-xs text-yellow-500 relative"
                  >{{ $t('app.paused') }}</span>
                  <div
                    v-show="!isMultiSelect"
                    class="relative flex items-center gap-0.5 opacity-0 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    :class="activeItems.has(item.id) ? 'opacity-100!' : ''"
                  >
                    <UButton
                      v-if="item.status === 'uploading'"
                      icon="i-lucide-pause"
                      variant="ghost"
                      size="xs"
                      class="text-gray-400 hover:text-yellow-500"
                      @click.stop="togglePause(item.id)"
                    />
                    <UButton
                      v-if="item.status === 'paused'"
                      icon="i-lucide-play"
                      variant="ghost"
                      size="xs"
                      class="text-gray-400 hover:text-green-500"
                      @click.stop="togglePause(item.id)"
                    />
                    <UPopover v-model:open="deletePopoverOpen[item.id]">
                      <UButton
                        icon="i-lucide-x"
                        variant="ghost"
                        size="xs"
                        class="text-gray-400 hover:text-red-500"
                      />
                      <template #content>
                        <div class="p-2 text-sm space-y-2 w-40">
                          <p class="text-gray-500">
                            {{ $t('app.confirmDelete') }}
                          </p>
                          <div class="flex gap-2 justify-end w-full">
                            <UButton
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              :label="$t('app.cancel')"
                              @click="deletePopoverOpen[item.id] = false"
                            />
                            <UButton
                              color="error"
                              variant="solid"
                              size="xs"
                              :label="$t('app.delete')"
                              @click="cancelTask(item.id); deletePopoverOpen[item.id] = false"
                            />
                          </div>
                        </div>
                      </template>
                    </UPopover>
                  </div>
                </div>
                <!-- History items (stored) -->
                <div
                  v-else
                  class="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 cursor-pointer select-none"
                  :class="activeItems.has(item.id) ? 'ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30' : ''"
                  @click="toggleActive(item.id)"
                  @pointerdown="onPointerDown(item.id)"
                  @pointerup="onPointerUp"
                  @pointerleave="onPointerLeave"
                >
                  <UIcon
                    v-if="isMultiSelect"
                    :name="activeItems.has(item.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
                    class="text-lg shrink-0 text-blue-500 relative"
                  />
                  <UIcon
                    :name="fileIcon((item as any).fileName || '')"
                    class="text-lg shrink-0"
                    :class="item.status === 'cancelled' ? 'text-red-400' : 'text-gray-400'"
                  />
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm truncate"
                      :class="item.status === 'cancelled' ? 'line-through text-red-500' : ''"
                    >
                      {{ (item as any).fileName }}
                    </p>
                    <p
                      class="text-xs"
                      :class="item.status === 'cancelled' ? 'text-red-400' : 'text-gray-400'"
                    >
                      {{ item.status === 'done' ? formatSize((item as any).fileSize) : (item.status === 'cancelled' ? $t('app.cancelled') : item.error) }}
                    </p>
                  </div>
                  <span
                    v-show="!isMultiSelect"
                    class="relative opacity-0 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    :class="activeItems.has(item.id) ? 'opacity-100!' : ''"
                  >
                    <UPopover v-model:open="deletePopoverOpen[(item as any).id]">
                      <UButton
                        icon="i-lucide-trash-2"
                        variant="ghost"
                        size="xs"
                        class="text-gray-400 hover:text-red-500"
                      />
                      <template #content>
                        <div class="p-2 text-sm space-y-2 w-40">
                          <p class="text-gray-500">{{ $t('app.confirmDelete') }}</p>
                          <div class="flex gap-2 justify-end w-full">
                            <UButton
                              color="neutral"
                              variant="ghost"
                              size="xs"
                              :label="$t('app.cancel')"
                              @click="deletePopoverOpen[(item as any).id] = false"
                            />
                            <UButton
                              color="error"
                              variant="solid"
                              size="xs"
                              :label="$t('app.delete')"
                              @click="removeHistory((item as any).id); deletePopoverOpen[(item as any).id] = false"
                            />
                          </div>
                        </div>
                      </template>
                    </UPopover>
                  </span>
                </div>
              </template>
              <div
                v-if="filteredTransferHistory.length === 0"
                class="text-center text-gray-400 py-10 text-sm"
              >
                {{ $t('app.noTransfers') }}
              </div>
            </div>
          </template>
        </UTabs>
      </template>
    </USlideover>

    <!-- File Preview -->
    <FileViewer
      v-if="previewFileData"
      :file="previewFileData.url"
      :file-name="previewFileData.name"
      :open="showPreview"
      @close="closePreview"
    />
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { DropdownMenuItem, TableColumn, ContextMenuItem } from '@nuxt/ui'
import { LazyTrashModal, LazyConfirmModal, LazyRenameModal, LazyShareModal, LazyShareManagerModal, LazyMoveFolderModal } from '#components'

definePageMeta({ middleware: 'auth' })

const { user, logout, refreshStorage } = useAuth()
const { locale, locales, setLocale, t } = useI18n()
const toast = useToast()
const { loadPreview, removeThumbnail } = useFileCache()

const { loading, loadAll, syncItem, getChildren, getItem, addItem, removeItem, items } = useFileIndex()

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
  loadCurrent()
})

watch(sortOrder, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('sort_order', val)
  loadCurrent()
})

watch(gridSize, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('grid_size', val)
})

watch(pathStack, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('current_path', JSON.stringify(val))
}, { deep: true })
const breadcrumbs = computed(() => [
  { id: null, name: t('app.home') },
  ...pathStack.value
])

const showCreate = ref(false)
const folderName = ref('')
const creating = ref(false)

// Folder name validation（禁止 / 与空字符）
const folderNameError = computed(() => {
  const name = folderName.value
  if (!name.trim()) return ''
  if (name.includes('/') || name.includes('\0')) return t('app.invalidChars')
  if (currentItems.value.some((i: any) => i.type === 'folder' && i.name === name.trim())) return t('app.duplicateName')
  return ''
})
const canCreate = computed(() => folderName.value.trim() && !folderNameError.value)

// Upload
const { tasks, history, addFiles, clearHistory, removeHistory, togglePause, cancelTask, saveHistory } = useUploader((record) => {
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
async function showConfirm(opts: {
  title: string
  message: string
  icon?: string
  list?: { name: string, type: 'file' | 'folder' }[]
  onConfirm: () => Promise<void>
}): Promise<void> {
  const overlay = useOverlay()
  await overlay.create(LazyConfirmModal).open(opts)
}

/** 打开分享模态框：分享右键项 + 多选选中的全部项目（文件/文件夹混选） */
function openShareForItem(item: any) {
  const overlay = useOverlay()
  const ids = new Set<string>()
  if (fileSelected.size > 1) {
    fileSelected.forEach(id => ids.add(id))
  }
  ids.add(item.id)
  const shareItems = Array.from(ids)
    .map((id) => {
      const it = getItem(id)
      return it ? { id: it.id, type: it.type, name: it.name } : null
    })
    .filter((x): x is { id: string, type: 'file' | 'folder', name: string } => x !== null)
  overlay.create(LazyShareModal).open({ items: shareItems })
}

/** 打开分享管理模态框 */
function openShareManager() {
  const overlay = useOverlay()
  overlay.create(LazyShareManagerModal).open({})
}

function getContextMenuItems(item: any): ContextMenuItem[][] {
  const isFolder = item.type === 'folder'
  const multi = fileSelected.size > 1
  return [
    [
      {
        label: isFolder ? t('app.open') : t('app.preview'),
        icon: isFolder ? 'i-lucide-folder' : 'i-lucide-eye',
        onSelect() {
          if (isFolder) onItemClick(item)
          else previewFile(item)
        }
      }
    ],
    [
      { label: t('app.rename'), icon: 'i-lucide-square-pen', onSelect() { renameItem(item) } }
    ],
    [
      {
        label: multi ? t('app.shareBatch') : t('app.share'),
        icon: 'i-lucide-share-2',
        onSelect() { openShareForItem(item) }
      }
    ],
    [
      {
        label: multi ? t('app.copyBatch') : t('app.copy'),
        icon: 'i-lucide-copy',
        onSelect() { enterClipboard(buildClipboardItems(item), 'copy') }
      },
      {
        label: multi ? t('app.cutBatch') : t('app.cut'),
        icon: 'i-lucide-scissors',
        onSelect() { enterClipboard(buildClipboardItems(item), 'cut') }
      }
    ],
    [
      {
        label: multi ? t('app.moveToTrashBatch') : t('app.moveToTrash'),
        icon: 'i-lucide-trash-2', color: 'error',
        onSelect() {
          // 批量删除：收集选中项列表供确认框展示
          const ids = fileSelected.size > 1 ? Array.from(fileSelected) : [item.id]
          const list = ids
            .map((id) => {
              const it = getItem(id)
              return it ? { name: it.name, type: it.type } : null
            })
            .filter((x): x is { name: string, type: 'file' | 'folder' } => x !== null)
          showConfirm({
            title: multi ? t('app.moveToTrashBatch') : t('app.moveToTrash'),
            message: multi ? t('app.confirmTrashBatch', { count: list.length }) : t('app.confirmTrash'),
            icon: 'i-lucide-trash-2',
            list,
            onConfirm: () => trashItem(item)
          })
        }
      }
    ]
  ]
}

// Image extensions for PhotoSwipe
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic', 'heif', 'tiff', 'tif', 'raw', 'psd']
// 视频扩展名（开启缩略图时为视频显示首帧封面）
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'ogv', 'wmv', 'flv', '3gp', 'ts', 'm2ts', 'mts', 'mpeg', 'mpg']

/** 是否为视频文件（按扩展名判断） */
function isVideoFile(item: any): boolean {
  if (item?.type !== 'file') return false
  const ext = (item.name || '').split('.').pop()?.toLowerCase() || ''
  return VIDEO_EXTS.includes(ext)
}

async function previewFile(item: any) {
  const ext = item.name.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.includes(ext)) {
    previewImage(item).catch(() => {})
  } else {
    // 非图片文件：优先从 IndexedDB 缓存加载，未命中则下载并写入缓存
    const url = await loadPreview({
      id: item.id,
      name: item.name,
      contentType: item.contentType,
      apiUrl: `/api/files/${item.id}/download`
    })
    previewObjectUrl.value = url.startsWith('blob:') ? url : null
    previewFileData.value = { url, name: item.name }
    showPreview.value = true
  }
}
const showPreview = ref(false)
const previewFileData = ref<{ url: string, name: string } | null>(null)
const previewObjectUrl = ref<string | null>(null)

function closePreview() {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = null
  }
  showPreview.value = false
  previewFileData.value = null
}

async function previewImage(item: any) {
  try {
    // Gather all images in current directory
    const allImages = filteredItems.value.filter((i: any) => {
      const ext = i.name.split('.').pop()?.toLowerCase() || ''
      return i.type === 'file' && IMAGE_EXTS.includes(ext)
    })
    const currentIndex = allImages.findIndex((i: any) => i.id === item.id)

    // 逐张加载（命中缓存直接用本地对象 URL，未命中则下载并写入缓存），同时获取尺寸。
    // 加载失败的图片（如已删除的陈旧条目）直接跳过，不让整个预览崩溃。
    const objectUrls: string[] = []
    const results = await Promise.all(allImages.map(async (imgItem: any) => {
      const url = await loadPreview({
        id: imgItem.id,
        name: imgItem.name,
        contentType: imgItem.contentType,
        apiUrl: `/api/files/${imgItem.id}/download`
      })
      if (url.startsWith('blob:')) objectUrls.push(url)
      const img = new Image()
      img.src = url
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
      })
      if (!loaded) return null
      return { src: url, width: img.naturalWidth, height: img.naturalHeight }
    }))
    const dataSource = results.filter((r): r is { src: string, width: number, height: number } => r !== null)
    if (dataSource.length === 0) return

    const { default: PhotoSwipeLightbox } = await import('photoswipe/lightbox')
    await import('photoswipe/style.css')

    const lightbox = new PhotoSwipeLightbox({
      dataSource,
      index: Math.max(0, currentIndex),
      pswpModule: () => import('photoswipe')
    })
    lightbox.init()
    lightbox.loadAndOpen(Math.max(0, currentIndex))
    lightbox.on('close', () => {
      lightbox.destroy()
      // 释放本次预览创建的对象 URL（缓存数据仍在 IndexedDB 中）
      objectUrls.forEach(u => URL.revokeObjectURL(u))
    })
  } catch {
    // 预览失败时静默处理，不产生未处理拒绝
  }
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
    }
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
  if (row.original.id === '__back__') {
    goBack()
    return
  }
  // 移动端多选模式：点击行切换选择
  if (mobileMultiSelect.value) {
    const id = row.original.id
    const s = new Set(fileSelected)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setFileSelection(s)
    return
  }
  onItemClick(row.original)
}

/** 打开移动目标选择器（移动端多选栏的“移动”） */
async function openMovePicker() {
  const ids = Array.from(fileSelected)
  if (!ids.length) return
  const overlay = useOverlay()
  const target = await overlay.create(LazyMoveFolderModal).open({ getChildren, getItem })
  if (!target) return
  mobileMultiSelect.value = false
  confirmMoveToFolder(ids, target.id, target.name)
}

/** 批量删除选中项（移动端多选栏的“删除”） */
async function deleteMultiSelected() {
  const ids = Array.from(fileSelected)
  if (!ids.length) return
  const overlay = useOverlay()
  await overlay.create(LazyConfirmModal).open({
    title: t('app.moveToTrash'),
    message: t('app.confirmTrashBatch', { count: ids.length }),
    icon: 'i-lucide-trash-2',
    confirmLabel: t('app.moveToTrash'),
    confirmColor: 'error',
    onConfirm: async () => {
      const first = getItem(ids[0]!)
      await trashItem(first ?? { id: ids[0]! })
      mobileMultiSelect.value = false
    }
  })
}

/** 退出移动端多选模式 */
function exitMobileSelect() {
  mobileMultiSelect.value = false
  fileSelected.clear()
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
  const ids = fileSelected.size > 1 ? Array.from(fileSelected) : [item.id]
  const names: string[] = []
  for (const id of ids) {
    const it = getItem(id)
    if (!it) continue
    const path = [...pathStack.value.map(p => p.name), it.name].join('/')
    try {
      await $fetch('/api/trash', {
        method: 'POST',
        body: { id, type: it.type, originalPath: path }
      })
      names.push(it.name)
      removeItem(id)
      // 同步清理该文件的封面帧缓存
      if (it.type === 'file') removeThumbnail(id)
    } catch { /* 单个失败继续下一个 */ }
  }
  clearFileSelection()
  loadCurrent()
  if (names.length > 0) {
    toast.add({
      title: `${names[0]}${names.length > 1 ? ` ${t('app.andMore', { count: names.length })}` : ''} ${t('app.moveToTrash')}`,
      icon: 'i-lucide-trash-2',
      duration: 3000
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
// 用 reactive Set：模板中每个 fileSelected.has(id) 按 id 独立跟踪，
// 只有进入/退出选择的项才重渲染；ref<Set> 每次整体赋值会全量重渲染整个网格（框选卡顿掉帧的根因）
const fileSelected = reactive(new Set<string>())

/** 整体替换选择集（clear + add，触发按 id 的精确重渲染） */
function setFileSelection(ids: Iterable<string>) {
  fileSelected.clear()
  for (const id of ids) fileSelected.add(id)
}

const dragIds = ref<string[]>([])
const dropTargetId = ref<string | null>(null)

// 复制/剪切剪贴板（进入复制剪切模式时工具栏切换）
const clipboard = ref<{ items: { id: string, type: string, name: string, icon: string, iconColor: string }[], mode: 'copy' | 'cut' } | null>(null)

const rubberBand = ref<{ x: number, y: number, w: number, h: number } | null>(null)
const rubberDragging = ref(false) // 框选/拾取拖拽中（禁用浏览器默认文字选中）
let rubberStart: { x: number, y: number } | null = null
let rubberMoved = false
let rubberItemRects: { id: string, rect: DOMRect }[] = []
// rAF 节流状态：pointermove 只记录最新坐标，每帧最多计算+渲染一次
let rubberLastX = 0
let rubberLastY = 0
let rubberFrame = 0
const gridContainer = ref<HTMLElement>()

// 移动端长按多选 / 拖拽到文件夹
const mobileMultiSelect = ref(false) // 长按多选模式（底部操作栏）
let rowLongPressTimer: ReturnType<typeof setTimeout> | null = null
let pickupActive = false // 长按触发后的“拾取拖拽”模式（拖到文件夹）
let pickupStartId: string | null = null // 长按起始行 id
let pickupSuppressClick = false // 长按结束后抑制该次 click（避免误打开/切换）

function clearFileSelection() {
  fileSelected.clear()
}

// ===== 复制 / 剪切 / 粘贴 =====
function isClipboardSource(id: string) {
  return clipboard.value?.items.some(i => i.id === id) ?? false
}

function buildClipboardItems(item: any) {
  const ids = fileSelected.size > 1 ? Array.from(fileSelected) : [item.id]
  return ids.map((id) => {
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
    duration: 2000
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
      duration: 3000
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
    const s = new Set(fileSelected)
    if (s.has(item.id)) s.delete(item.id)
    else s.add(item.id)
    setFileSelection(s)
    mobileMultiSelect.value = s.size > 0
    return
  }
  // Shift：范围选择
  if (e.shiftKey) {
    const ids = filteredItems.value.map(i => i.id)
    const cur = ids.indexOf(item.id)
    let anchor = -1
    for (let i = ids.length - 1; i >= 0; i--) {
      if (fileSelected.has(ids[i])) {
        anchor = i
        break
      }
    }
    if (anchor >= 0 && cur >= 0) {
      const s = new Set(fileSelected)
      const [a, b] = anchor < cur ? [anchor, cur] : [cur, anchor]
      for (let i = a; i <= b; i++) s.add(ids[i])
      setFileSelection(s)
      mobileMultiSelect.value = s.size > 0
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
  setFileSelection([item.id])
  onItemClick(item)
}

// 框选（rubber band）— 宫格 + 列表通用
let rubberFromRow = false // pointerdown 是否落在列表行上
function onGridPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  // 每次按下先重置拖拽标记（避免上次拖拽残留影响本次点击/拦截）
  rubberMoved = false
  rubberFromRow = false
  const target = e.target as HTMLElement
  // 网格项 / 返回项内部不启动（拖动由 dragstart 处理）
  if (target.closest('[data-grid-item]') || target.closest('[data-rubber-ignore]')) return
  // 点击交互控件（行内操作按钮、输入、菜单项等）不启动
  if (target.closest('button, a, input, select, textarea, [role="menuitem"], [role="menuitemcheckbox"]')) return
  // 表头 / 分隔线不启动
  if (target.closest('table thead, tr[data-slot="separator"]')) return
  // 进入框选/拾取流程：禁用浏览器默认文字选中（避免拖动时选中文本）
  rubberDragging.value = true
  // 是否落在列表数据行上（行点击默认打开/预览；拖拽则进入框选）
  rubberFromRow = !!target.closest('main table tbody tr[data-slot="tr"]')
  // 长按（按住 ~450ms 不移动）进入多选模式并可拖到文件夹（触屏/鼠标通用）
  if (rubberFromRow) {
    const rowEl = target.closest('main table tbody tr[data-slot="tr"]') as HTMLElement | null
    const rowId = getItemIdFromRow(rowEl)
    pickupStartId = rowId
    clearRowLongPressTimer()
    rowLongPressTimer = setTimeout(() => {
      if (rowId && rowId !== '__back__') {
        mobileMultiSelect.value = true
        if (!fileSelected.has(rowId)) {
          const s = new Set(fileSelected)
          s.add(rowId)
          setFileSelection(s)
        }
        pickupActive = true
        pickupSuppressClick = true
      }
    }, 450)
  }
  rubberStart = { x: e.clientX, y: e.clientY }
  // 延迟到首次真正框选时再计算 item 矩形（点击空白不触发批量 getBoundingClientRect）
  rubberItemRects = []
  window.addEventListener('pointermove', onRubberMove)
  window.addEventListener('pointerup', onRubberUp)
  window.addEventListener('pointercancel', onRubberUp)
  window.addEventListener('blur', onRubberUp)
  // 捕获阶段拦截行点击：拖拽框选后阻止该次点击触发行打开/预览
  window.addEventListener('click', onRubberClickCapture, true)
}

/** 由列表行 DOM 反查 item id（tbody 行按顺序对应 tableData） */
function getItemIdFromRow(tr: Element | null): string | null {
  if (!tr) return null
  const tbody = tr.closest('tbody')
  if (!tbody) return null
  const rows = Array.from(tbody.querySelectorAll('tr[data-slot="tr"]'))
  const idx = rows.indexOf(tr)
  return tableData.value[idx]?.id ?? null
}

function clearRowLongPressTimer() {
  if (rowLongPressTimer) {
    clearTimeout(rowLongPressTimer)
    rowLongPressTimer = null
  }
}

/** 收集当前视图可被框选的目标矩形（宫格项 / 列表行） */
function getRubberItems(): { id: string, rect: DOMRect }[] {
  if (viewMode.value === 'grid') {
    return Array.from(gridContainer.value?.querySelectorAll('[data-grid-item]') || []).map(el => ({
      id: el.getAttribute('data-id')!,
      rect: el.getBoundingClientRect()
    }))
  }
  // 列表：tbody 数据行按顺序对应 tableData（含 ../ 返回行，跳过）
  const tbody = document.querySelector('main table tbody')
  if (!tbody) return []
  const trs = Array.from(tbody.querySelectorAll('tr[data-slot="tr"]'))
  const data = tableData.value
  const out: { id: string, rect: DOMRect }[] = []
  trs.forEach((tr, i) => {
    const item = data[i]
    if (!item || item.id === '__back__') return
    out.push({ id: item.id, rect: tr.getBoundingClientRect() })
  })
  return out
}

/** 捕获阶段拦截行点击：拖拽框选 / 长按拾取后阻止该次点击触发行打开/预览（处理一次即自移除） */
function onRubberClickCapture(e: MouseEvent) {
  if (rubberMoved || pickupSuppressClick) {
    e.preventDefault()
    e.stopPropagation()
  }
  pickupSuppressClick = false
  window.removeEventListener('click', onRubberClickCapture, true)
}

// pointermove 只记录坐标，通过 rAF 合并到每帧一次，避免每像素重渲染
function onRubberMove(e: PointerEvent) {
  if (!rubberStart) return
  rubberLastX = e.clientX
  rubberLastY = e.clientY
  // 长按拾取模式：拖到文件夹
  if (pickupActive) {
    updatePickupDrag(e)
    return
  }
  // 移动超过阈值：取消长按计时器（进入框选）
  if (rowLongPressTimer && (Math.abs(rubberLastX - rubberStart.x) > 10 || Math.abs(rubberLastY - rubberStart.y) > 10)) {
    clearRowLongPressTimer()
  }
  if (rubberFrame) return
  rubberFrame = requestAnimationFrame(updateRubber)
}

/** 长按拾取拖拽：高亮指针下的文件夹行，供松手时移动全部选中项 */
function updatePickupDrag(e: PointerEvent) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const row = el?.closest?.('main table tbody tr[data-slot="tr"]') as HTMLElement | null
  let newTarget: string | null = null
  if (row) {
    const id = getItemIdFromRow(row)
    const item = id ? getItem(id) : undefined
    if (id && id !== pickupStartId && item?.type === 'folder' && !fileSelected.has(id)) {
      newTarget = id
    }
  }
  if (newTarget !== dropTargetId.value) dropTargetId.value = newTarget
}

function updateRubber() {
  rubberFrame = 0
  if (!rubberStart) return
  const dx = rubberLastX - rubberStart.x
  const dy = rubberLastY - rubberStart.y
  // 2px 阈值：更快出现框，减少延迟感
  if (!rubberMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
    rubberMoved = true
    // 清除浏览器已选中的文本，避免框选时残留文字高亮
    window.getSelection()?.removeAllRanges()
    // 首次框选时再批量获取 item 矩形（宫格项 / 列表行）
    rubberItemRects = getRubberItems()
  }
  if (!rubberMoved) return
  const x = Math.min(rubberStart.x, rubberLastX)
  const y = Math.min(rubberStart.y, rubberLastY)
  const w = Math.abs(dx)
  const h = Math.abs(dy)
  rubberBand.value = { x, y, w, h }
  const s = new Set<string>()
  for (const { id, rect } of rubberItemRects) {
    if (rect.left < x + w && rect.right > x && rect.top < y + h && rect.bottom > y) {
      s.add(id)
    }
  }
  // 仅当选择真正变化时才赋值，避免每帧全量重渲染网格
  if (!sameSet(s, fileSelected)) {
    setFileSelection(s)
    // 框选产生选择 → 进入多选模式（显示复选框列 + 底部操作栏）
    if (s.size > 0) mobileMultiSelect.value = true
  }
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function onRubberUp() {
  // 若有未执行的帧，先同步处理最后一次移动，避免最后的选择丢失
  if (rubberFrame) {
    rubberFrame = 0
    if (!pickupActive) updateRubber()
  }
  window.removeEventListener('pointermove', onRubberMove)
  window.removeEventListener('pointerup', onRubberUp)
  window.removeEventListener('pointercancel', onRubberUp)
  window.removeEventListener('blur', onRubberUp)
  clearRowLongPressTimer()
  const wasPickup = pickupActive
  pickupActive = false
  pickupStartId = null
  rubberBand.value = null
  rubberDragging.value = false
  rubberStart = null
  rubberItemRects = []
  if (wasPickup) {
    // 长按拾取结束：落到文件夹 → 移动全部选中；否则保持多选模式
    const targetFolderId = dropTargetId.value
    dropTargetId.value = null
    if (targetFolderId) {
      const folder = getItem(targetFolderId)
      const ids = Array.from(fileSelected)
      mobileMultiSelect.value = false
      if (folder && ids.length && !ids.includes(targetFolderId)) confirmMove(ids, folder)
    }
    return
  }
  if (!rubberMoved && !rubberFromRow) {
    // 点击空白：未进入多选模式 → 清除选择并退出；
    // 已在多选模式（框选/长按/Ctrl 多选）→ 保留模式，不自动退出
    if (!mobileMultiSelect.value) {
      fileSelected.clear()
      mobileMultiSelect.value = false
    }
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
  await uploadDroppedFiles(e, currentFolderId.value)
}

/**
 * 处理外部拖入的文件/文件夹，上传到指定文件夹。
 * folderId 为 null 时使用当前文件夹。
 */
async function uploadDroppedFiles(e: DragEvent, folderId: string | null) {
  // 优先用 items + webkitGetAsEntry 递归遍历（支持拖动文件夹，跨浏览器）
  const items = Array.from(e.dataTransfer?.items || [])
  const walkable = items.filter(it => (it as any).webkitGetAsEntry || (it as any).getAsEntry)
  if (walkable.length) {
    const groups = await Promise.all(walkable.map((it) => {
      const entry = (it as any).webkitGetAsEntry ? (it as any).webkitGetAsEntry() : (it as any).getAsEntry()
      return entry ? walkFileEntry(entry) : Promise.resolve([])
    }))
    const walked = groups.flat()
    const files = walked.map(g => g.file)
    if (files.length > 0) {
      const pathMap = new Map(walked.map(g => [g.file, g.path] as const))
      await handleDroppedFiles(files, pathMap, folderId)
      return
    }
    // walk 无结果（如 webkitGetAsEntry 返回 null）→ 继续尝试 files 兜底
  }

  // 兜底：dataTransfer.files（部分浏览器拖入文件夹会带上 webkitRelativePath）
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length === 0) return
  await handleDroppedFiles(files, undefined, folderId)
}

// 拖拽移动
function onGridDragStart(item: any, e: DragEvent) {
  if (!fileSelected.has(item.id)) {
    setFileSelection([item.id])
  }
  dragIds.value = Array.from(fileSelected)
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
  // 兜底：若 dragIds 未记录（极端情况），尝试从 dataTransfer 恢复
  if (dragIds.value.length === 0) {
    const fromDt = (e.dataTransfer?.getData(INTERNAL_DRAG_TYPE) || '').split(',').filter(Boolean)
    if (fromDt.length) dragIds.value = fromDt
  }
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

async function onFolderDrop(item: any, e: DragEvent) {
  if (item.type !== 'folder') return
  e.preventDefault()
  e.stopPropagation()
  // 外部文件/文件夹拖到文件夹 → 直接上传到该文件夹（无需等待悬停自动进入）
  if (isExternalDrag(e)) {
    await uploadDroppedFiles(e, item.id)
    return
  }
  // 内部拖拽移动
  const ids = dragIds.value.length
    ? dragIds.value
    : (e.dataTransfer?.getData(INTERNAL_DRAG_TYPE) || e.dataTransfer?.getData('text/plain') || '').split(',').filter(Boolean)
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
  const itemsPayload = ids.map((id) => {
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
          body: { items: itemsPayload, targetFolderId }
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
          duration: 3000
        })
      } catch (e: any) {
        toast.add({ title: e?.data?.message || t('app.moveFailed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 })
        throw e
      }
    }
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
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
function onPointerLeave() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
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
// 进行中任务的状态优先级：上传中 > 已暂停 > 排队等待
const transferStatusRank: Record<string, number> = { uploading: 0, paused: 1, pending: 2 }
const latestHistory = computed(() => {
  // 进行中的任务（上传中/暂停/排队）始终排在最前，其次是最新完成的记录，共显示 5 条
  const active = tasks.value
    .filter(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'paused')
    .sort((a, b) => (transferStatusRank[a.status] ?? 9) - (transferStatusRank[b.status] ?? 9))
  const done = history.value.slice().sort((a, b) => (b.time || 0) - (a.time || 0))
  return [...active, ...done].slice(0, 5)
})
const transferTabs = computed(() => [
  { label: `${$t('app.uploading')} (${activeCount.value})`, icon: 'i-lucide-arrow-up-down', value: 'uploading' },
  { label: `${$t('app.completed')} (${historyCount.value})`, icon: 'i-lucide-circle-check', value: 'completed' }
])
const filteredTransferHistory = computed(() => {
  const filter = transferFilter.value
  if (transferTab.value === 'uploading') {
    // 上传中任务置顶，其次暂停/排队
    return tasks.value
      .filter(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'paused')
      .filter(t => filter === 'all' || t.type === filter)
      .sort((a, b) => (transferStatusRank[a.status] ?? 9) - (transferStatusRank[b.status] ?? 9))
  }
  // 已完成：按时间倒序（最近的在前面）
  return history.value
    .filter(h => filter === 'all' || h.type === filter)
    .sort((a, b) => (b.time || 0) - (a.time || 0))
})

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

/**
 * 递归遍历拖入的目录项（DataTransferItem.webkitGetAsEntry），
 * 返回 { file, path } 列表，path 为相对路径（如 "folder/sub/a.txt"）。
 * 支持 Firefox（getAsEntry）与 Chrome/Edge/Safari（webkitGetAsEntry）。
 */
function walkFileEntry(entry: any): Promise<{ file: File, path: string }[]> {
  return new Promise((resolve) => {
    if (!entry) return resolve([])
    if (entry.isFile) {
      entry.file((file: File) => {
        const path = (file as any).webkitRelativePath || entry.fullPath.replace(/^\/+/, '')
        resolve([{ file, path }])
      }, () => resolve([]))
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const all: any[] = []
      const readBatch = () => {
        reader.readEntries((batch: any[]) => {
          if (batch.length === 0) {
            Promise.all(all.map(e => walkFileEntry(e))).then(groups => resolve(groups.flat()))
            return
          }
          all.push(...batch)
          readBatch()
        }, () => resolve([]))
      }
      readBatch()
    } else {
      resolve([])
    }
  })
}

async function handleDroppedFiles(files: File[], pathMap?: Map<File, string>, targetFolderId?: string | null) {
  // 目标文件夹：外部拖到文件夹上时传入该文件夹 id，否则用当前文件夹
  const baseFolderId = targetFolderId ?? currentFolderId.value
  const getPath = (f: File) => (pathMap?.get(f)) || f.webkitRelativePath || ''

  // 纯文件拖入（无文件夹结构）
  if (!files.some(f => getPath(f))) {
    addFiles(files, baseFolderId)
    showTransferPopover.value = true
    return
  }

  // 含文件夹：构建目录树（去重所有父路径）
  const folderPaths = new Set<string>()
  for (const file of files) {
    const parts = getPath(file).split('/')
    for (let i = 0; i < parts.length - 1; i++) {
      folderPaths.add(parts.slice(0, i + 1).join('/'))
    }
  }

  // 递归创建文件夹（父级优先）
  const folderMap = new Map<string, string | null>() // path → folderId
  folderMap.set('', baseFolderId)

  for (const path of [...folderPaths].sort()) {
    const parentPath = path.split('/').slice(0, -1).join('/')
    const parentId = folderMap.get(parentPath) ?? null
    const name = path.split('/').pop()!
    try {
      const res = await $fetch<any>('/api/folders', {
        method: 'POST',
        body: { name, parentId }
      })
      folderMap.set(path, res.id)
      // 同步到本地索引，确保创建后立即显示（否则 loadCurrent 读索引仍为空）
      syncItem(res)
    } catch {
      // 可能已存在，兜底为当前文件夹
      folderMap.set(path, null)
    }
  }

  // 按各自路径上传文件
  for (const file of files) {
    const rel = getPath(file)
    const folderPath = rel.split('/').slice(0, -1).join('/')
    const folderId = folderMap.get(folderPath) ?? baseFolderId
    // 用 basename 重建 File（目录文件的 name 可能是相对路径）
    const baseName = rel.split('/').pop() || file.name
    const renamed = new File([file], baseName, { type: file.type })
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
  sub: t('app.searchSub')
}[searchScope.value]))

const searchScopeMenuItems = computed(() => [[
  { label: t('app.searchAll'), checked: searchScope.value === 'all', onSelect() { searchScope.value = 'all' } },
  { label: t('app.searchCurrent'), checked: searchScope.value === 'current', onSelect() { searchScope.value = 'current' } },
  { label: t('app.searchSub'), checked: searchScope.value === 'sub', onSelect() { searchScope.value = 'sub' } }
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
          folderId: currentFolderId.value ?? ''
        }
      })
      searchResults.value = [...(res.folders || []), ...(res.files || [])].map(toItem)
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
})

// Unified filtered items: client-side for 'current', server-side for 'all'/'sub'
const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return currentItems.value
  if (searchScope.value !== 'current') return searchResults.value
  return currentItems.value.filter(item =>
    item.name.toLowerCase().includes(q)
  )
})

const tableData = computed(() => {
  const backItem = pathStack.value.length > 0
    ? [{ id: '__back__', name: '../', type: 'folder', icon: 'fluent-emoji:open-file-folder', iconColor: 'text-amber-500', size: undefined, rawSize: undefined, modified: undefined }]
    : []
  // 附加 dropTarget 字段（依赖 dropTargetId 重算），驱动拖拽目标文件夹高亮；行选中改用 UTable 原生 row-selection
  const items = filteredItems.value.map((i: any) => ({ ...i, dropTarget: dropTargetId.value === i.id }))
  return [...backItem, ...items]
})

// 拖拽目标文件夹高亮（meta.class.tr 由 UTable 按行渲染调用）
const tableMeta = {
  class: {
    tr: (row: any) => (row.original?.dropTarget ? 'ring-2 ring-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40' : '')
  }
}

// UTable 原生行选择：与 fileSelected 双向同步（参考 ui.nuxt.com/docs/components/table#with-row-selection）
const rowIdGetter = (row: any) => row.id
const rowSelection = computed<Record<string, boolean>>({
  get: () => Object.fromEntries(Array.from(fileSelected).map(id => [id, true])),
  set: (val) => setFileSelection(Object.keys(val || {}).filter(k => val[k]))
})
const allRowsSelected = computed(() => filteredItems.value.length > 0 && filteredItems.value.every(i => fileSelected.has(i.id)))
// “部分但非全部”选中（全部选中时表头应显示勾选而非半选）
const someRowsSelected = computed(() => {
  const selected = filteredItems.value.filter(i => fileSelected.has(i.id)).length
  return selected > 0 && selected < filteredItems.value.length
})
function toggleAllRows(value: boolean) {
  if (value) {
    setFileSelection(filteredItems.value.map(i => i.id))
  } else {
    const s = new Set(fileSelected)
    for (const i of filteredItems.value) s.delete(i.id)
    setFileSelection(s)
  }
}

const contextItem = ref<any>(null)
const contextMenuItems = ref<ContextMenuItem[][]>([])

function onTableContextmenu(_e: Event, row: any) {
  if (row.original.id === '__back__') {
    contextMenuItems.value = []
    return
  }
  contextItem.value = row.original
  contextMenuItems.value = getContextMenuItems(row.original)
}

// 列数组引用缓存：仅「是否显示复选框列」变化时才重建，选中数量变化不触发
// UTable 重建（否则行内 VideoThumbnail 等会重新挂载、缩略图重新加载转圈）
let tableColumnsCache: { key: boolean, value: TableColumn<any>[] } | null = null
const tableColumns = computed<TableColumn<any>[]>(() => {
  const showSelect = mobileMultiSelect.value
  if (tableColumnsCache && tableColumnsCache.key === showSelect) return tableColumnsCache.value
  const cols: TableColumn<any>[] = [
  // 复选框列：仅多选模式下显示（长按进入 / 底部操作栏出现时）
  ...(showSelect ? [{
    id: 'select',
    header: () => h(resolveComponent('UCheckbox'), {
      modelValue: someRowsSelected.value ? 'indeterminate' : allRowsSelected.value,
      'onUpdate:modelValue': (value: boolean) => toggleAllRows(value),
      'aria-label': 'Select all'
    }),
    cell: ({ row }: any) => {
      if (row.original.id === '__back__') return ''
      return h(resolveComponent('UCheckbox'), {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean) => row.toggleSelected(!!value),
        'aria-label': 'Select row'
      })
    },
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-10 text-center', td: 'w-10 text-center' } }
  }] : []),
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
          : isVideoFile(item) && enableThumbnails.value
            ? h(resolveComponent('VideoThumbnail'), { id: item.id, src: `/api/files/${item.id}/download`, alt: item.name, contentType: item.contentType, loading: 'lazy', class: 'h-9 w-9 shrink-0 rounded' })
            : h(resolveComponent('UIcon'), { name: item.icon, class: `text-xl shrink-0 ${item.iconColor || 'text-gray-400'}` }),
        h('span', { class: 'truncate' }, item.name)
      ])
    }
  },
  {
    accessorKey: 'modified',
    header: '修改时间',
    meta: { class: { th: 'hidden md:table-cell min-w-[160px] text-left', td: 'hidden md:table-cell min-w-[160px] text-sm text-gray-500' } },
    cell: ({ row }) => {
      const ts: any = row.getValue('modified')
      if (!ts) return ''
      return new Date(ts).toLocaleString()
    }
  },
  {
    accessorKey: 'size',
    header: '文件大小',
    meta: { class: { th: 'hidden md:table-cell min-w-[95px] text-right', td: 'hidden md:table-cell min-w-[95px] text-right text-sm text-gray-500' } },
    cell: ({ row }) => row.getValue('size') || ''
  },
  {
    id: 'actions',
    header: '操作',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-11 md:min-w-[130px] text-right', td: 'w-11 md:min-w-[130px] text-right' } },
    cell: ({ row }) => {
      const item = row.original
      if (item.id === '__back__') return ''
      const items = getContextMenuItems(item)
      return h('div', { class: 'flex items-center justify-end gap-0.5' }, [
        // 重命名（移动端隐藏，md+ 显示）
        h(resolveComponent('UButton'), {
          'icon': 'i-lucide-square-pen',
          'class': 'hidden md:inline-flex',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'sm',
          'aria-label': t('app.rename'),
          'onClick': () => renameItem(item)
        }),
        // 下载（移动端隐藏，md+ 显示）
        h(resolveComponent('UButton'), {
          'icon': 'i-lucide-download',
          'class': 'hidden md:inline-flex',
          'color': 'neutral',
          'variant': 'ghost',
          'size': 'sm',
          'aria-label': t('app.download'),
          'onClick': () => downloadFile(item)
        }),
        // 菜单（与右键菜单统一：顶部文件信息头 + 相同菜单项）
        h(resolveComponent('UDropdownMenu'), {
          'content': { align: 'end' },
          items,
          'aria-label': 'Actions'
        }, {
          // 与右键菜单一致的顶部文件信息头
          'content-top': () => h(resolveComponent('MenuFileHeader'), {
            item,
            selectedCount: fileSelected.size,
            getChildren
          }),
          default: () => h(resolveComponent('UButton'), {
            'icon': 'i-lucide-ellipsis-vertical',
            'color': 'neutral',
            'variant': 'ghost',
            'size': 'sm',
            'aria-label': 'Actions'
          })
        })
      ])
    }
  }
  ]
  tableColumnsCache = { key: showSelect, value: cols }
  return cols
})

const viewMenuItems = computed((): DropdownMenuItem[][] => [
  [
    { type: 'label' as const, label: t('app.viewMode') },
    { label: t('app.grid'), icon: 'i-lucide-layout-grid', type: 'checkbox' as const, checked: viewMode.value === 'grid', onUpdateChecked() { viewMode.value = 'grid' } },
    { label: t('app.list'), icon: 'i-lucide-list', type: 'checkbox' as const, checked: viewMode.value === 'list', onUpdateChecked() { viewMode.value = 'list' } }
  ],
  [
    { type: 'label' as const, label: t('app.display') },
    { label: t('app.small'), icon: 'i-lucide-case-lower', type: 'checkbox' as const, checked: gridSize.value === 'sm', onUpdateChecked() { gridSize.value = 'sm' } },
    { label: t('app.medium'), icon: 'i-lucide-case-sensitive', type: 'checkbox' as const, checked: gridSize.value === 'md', onUpdateChecked() { gridSize.value = 'md' } },
    { label: t('app.large'), icon: 'i-lucide-case-upper', type: 'checkbox' as const, checked: gridSize.value === 'lg', onUpdateChecked() { gridSize.value = 'lg' } }
  ],
  [
    {
      label: t('app.enableThumbnails'), icon: 'i-lucide-image', slot: 'switch' as const,
      checked: enableThumbnails.value,
      onSelect(e: Event) {
        e.preventDefault()
        enableThumbnails.value = !enableThumbnails.value
      }
    }
  ]
])

const sortMenuItems = computed((): DropdownMenuItem[][] => [
  [
    { type: 'label' as const, label: t('app.sortBy') },
    { label: t('app.sortByName'), icon: 'i-lucide-a-large-small', type: 'checkbox' as const, checked: sortBy.value === 'name', onUpdateChecked() { sortBy.value = 'name' } },
    { label: t('app.sortBySize'), icon: 'i-lucide-server', type: 'checkbox' as const, checked: sortBy.value === 'size', onUpdateChecked() { sortBy.value = 'size' } },
    { label: t('app.sortByType'), icon: 'i-lucide-file-type', type: 'checkbox' as const, checked: sortBy.value === 'type', onUpdateChecked() { sortBy.value = 'type' } },
    { label: t('app.sortByModified'), icon: 'i-lucide-history', type: 'checkbox' as const, checked: sortBy.value === 'modified', onUpdateChecked() { sortBy.value = 'modified' } }
  ],
  [
    { label: t('app.asc'), icon: 'i-lucide-arrow-down-a-z', type: 'checkbox' as const, checked: sortOrder.value === 'asc', onUpdateChecked() { sortOrder.value = 'asc' } },
    { label: t('app.desc'), icon: 'i-lucide-arrow-up-a-z', type: 'checkbox' as const, checked: sortOrder.value === 'desc', onUpdateChecked() { sortOrder.value = 'desc' } }
  ]
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
    gap: size === 'sm' ? 'gap-0.5' : size === 'lg' ? 'gap-3' : 'gap-2'
  }
})

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

const addMenuItems = computed(() => [
  [
    { label: t('app.upload'), icon: 'i-lucide-upload', onSelect() { fileInput.value?.click() } },
    { label: t('app.uploadFolder'), icon: 'i-lucide-folder-input', onSelect() { folderInput.value?.click() } },
    { label: t('app.create'), icon: 'i-lucide-folder-plus', onSelect() { showCreate.value = true } }
  ]
])

const menuItems = computed(() => [
  [
    { type: 'label' as const, label: user.value?.email || t('app.notLoggedIn') }
  ],
  [
    { type: 'label' as const, slot: 'storage', label: '' }
  ],
  [
    { label: t('app.shareManager'), icon: 'i-lucide-share-2', onSelect: () => openShareManager() },
    { label: t('app.settings'), icon: 'i-lucide-settings', to: '/settings' },
    { label: t('app.logout'), icon: 'i-lucide-log-out', onSelect: () => logout() }
  ]
])

/** 存储占用百分比（0-100，完全向上进位不舍，保留 1 位小数） */
const storagePercent = computed(() => {
  const used = Number(user.value?.storageUsed ?? 0)
  const limit = Number(user.value?.storageLimit ?? 0)
  if (limit <= 0) return 0
  // 乘 10 后向上取整再除回：任何非零余数都进位，不舍弃
  return Math.min(100, Math.max(0, Math.ceil((used / limit) * 1000) / 10))
})

/** 打开用户菜单时刷新最新存储占用 */
function onUserMenuOpen(open: boolean) {
  if (open) refreshStorage()
}

function openTrash() {
  const overlay = useOverlay()
  overlay.create(LazyTrashModal).open({
    onRestored: (record) => {
      if (record?.id) syncItem(record)
      loadCurrent()
    }
  })
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
    contentType: isFile ? (raw.contentType || '') : undefined,
    isImage: isFile && IMAGE_EXTS.includes(ext)
  }
}

onMounted(() => loadAll().finally(loadCurrent))

// 索引数据变化（用户切换/登录后同步完成）时刷新当前目录
watch(items, () => loadCurrent())

/** 当前目录排序：文件夹始终在前，再按 sortBy + sortOrder */
function applySort(list: any[]): any[] {
  const arr = [...list]
  const dir = sortOrder.value === 'desc' ? -1 : 1
  const localeCmp = (s1: string, s2: string) =>
    (s1 || '').localeCompare(s2 || '', undefined, { numeric: true, sensitivity: 'base' })
  // 兼容 unix 秒/毫秒时间戳与 ISO 字符串
  const time = (v: any): number => {
    if (!v) return 0
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
    const t = Date.parse(String(v))
    return Number.isFinite(t) ? t : 0
  }
  arr.sort((a, b) => {
    // 文件夹始终排在文件前
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    let r = 0
    switch (sortBy.value) {
      case 'size':
        r = (a.rawSize ?? 0) - (b.rawSize ?? 0)
        if (r !== 0) break
        r = localeCmp(a.name, b.name)
        break
      case 'type':
        r = (a.contentType || '').localeCompare(b.contentType || '')
        if (r !== 0) break
        r = localeCmp(a.name, b.name)
        break
      case 'modified':
        r = time(a.modified) - time(b.modified)
        if (r !== 0) break
        r = localeCmp(a.name, b.name)
        break
      default: // name
        r = localeCmp(a.name, b.name)
    }
    return r * dir
  })
  return arr
}

async function loadCurrent() {
  currentItems.value = applySort(getChildren(currentFolderId.value))
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
  } finally { creating.value = false }
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}

/** 格式化上传日期（兼容 unix 秒/毫秒时间戳与 ISO 字符串） */
function formatDate(v: any): string {
  if (!v) return ''
  const n = Number(v)
  let d: Date
  if (Number.isFinite(n) && n > 0) {
    d = new Date(n < 1e12 ? n * 1000 : n)
  } else {
    d = new Date(v)
  }
  if (Number.isNaN(d.getTime())) return ''
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>
