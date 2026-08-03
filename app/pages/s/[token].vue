<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- 顶部栏 -->
    <header class="h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-share-2"
          class="text-primary"
        />
        <span class="font-semibold">CloudDrive R2</span>
      </div>
      <div class="flex items-center gap-1">
        <UDropdownMenu :items="langMenuItems">
          <UButton
            icon="i-lucide-languages"
            variant="ghost"
            size="sm"
          />
        </UDropdownMenu>
        <span class="text-xs text-gray-400">
          {{ t('app.sharePageTag') }}
        </span>
      </div>
    </header>

    <main
      class="max-w-4xl mx-auto p-4"
      :class="{ 'select-none': rubberDragging }"
      @pointerdown="onPointerDown"
    >
      <!-- 框选覆盖层（长按/框选多选） -->
      <div
        v-if="rubberBand"
        class="fixed z-20 border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
        :style="{
          left: rubberBand.x + 'px',
          top: rubberBand.y + 'px',
          width: rubberBand.w + 'px',
          height: rubberBand.h + 'px'
        }"
      />
      <!-- 加载 -->
      <div
        v-if="loading"
        class="flex justify-center py-16"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="text-2xl text-gray-400 animate-spin"
        />
      </div>

      <!-- 错误 -->
      <UCard
        v-else-if="error"
        class="mt-8"
      >
        <div class="text-center py-6 text-sm text-gray-500">
          {{ error }}
        </div>
      </UCard>

      <!-- 密码验证 -->
      <UCard
        v-else-if="share?.hasPassword && !authorized"
        class="mt-8 max-w-sm mx-auto"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-lock"
              class="text-gray-400"
            />
            <span class="font-medium">{{ t('app.sharePasswordRequired') }}</span>
          </div>
        </template>
        <div class="space-y-3">
          <UPinInput
            v-model="pinValue"
            :length="6"
            size="lg"
            class="w-full justify-center"
            @complete="verify"
          />
          <p
            v-if="pwdError"
            class="text-sm text-red-500 text-center"
          >
            {{ pwdError }}
          </p>
          <UButton
            color="primary"
            block
            :loading="verifying"
            @click="verify"
          >
            {{ t('app.shareVerify') }}
          </UButton>
        </div>
      </UCard>

      <!-- 分享内容 -->
      <template v-else>
        <!-- 路径栏：分享目录 > 子文件夹 -->
        <nav class="flex items-center gap-1 text-sm text-gray-500 mb-3 overflow-x-auto">
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
        </nav>

        <!-- 工具栏：全选 / 已选计数 / 视图切换 / 打包下载 -->
        <div class="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div class="flex items-center gap-3 text-sm text-gray-500">
            <button
              class="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              @click="toggleSelectAll"
            >
              <UIcon
                :name="allSelected ? 'i-lucide-check-square' : 'i-lucide-square'"
                class="text-base"
              />
              <span>{{ t('app.shareSelectAll') }}</span>
            </button>
            <span
              v-if="selected.size > 0"
              class="text-xs"
            >
              {{ t('app.shareSelected', { count: selected.size }) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <!-- 视图切换（宫格 / 列表） -->
             <UFieldGroup>
              <UButton
                :variant="viewMode === 'grid' ? 'solid' : 'subtle'"
                :title="t('app.grid')"
                @click="viewMode = 'grid'"
                icon="i-lucide-layout-grid"
                size="sm"
              />
              <UButton
                :variant="viewMode === 'list' ? 'solid' : 'subtle'"
                :title="t('app.list')"
                @click="viewMode = 'list'"
                icon="i-lucide-list"
                size="sm"
              />
            </UFieldGroup>
            <UButton
              v-if="selected.size > 0"
              variant="ghost"
              size="sm"
              @click="clearSelection"
            >
              {{ t('app.shareClearSelection') }}
            </UButton>
            <UButton
              color="primary"
              size="sm"
              icon="i-lucide-archive"
              :loading="zipping"
              :disabled="selected.size === 0"
              @click="confirmDownload"
            >
              {{ t('app.shareDownloadZip') }}
            </UButton>
          </div>
        </div>

        <!-- 空态 -->
        <div
          v-if="!loading && items.length === 0"
          class="py-16 text-center text-sm text-gray-400"
        >
          {{ t('app.shareEmptyFolder') }}
        </div>

        <!-- 宫格视图（外观与主界面一致，默认开启缩略图且不使用缓存） -->
        <div
          v-if="viewMode === 'grid'"
          class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-2"
        >
          <div
            v-for="item in items"
            :key="item.id"
            data-grid-item="true"
            :data-id="item.id"
            class="relative flex flex-col items-center rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-transform select-none gap-1 p-2"
            :class="isSelected(item.id) ? 'ring-2 ring-blue-400 bg-blue-50/60 dark:bg-blue-950/30' : ''"
          >
            <!-- 勾选按钮 -->
            <button
              class="absolute top-1 left-1 z-10"
              :title="t('app.shareToggleSelect')"
              @click.stop="toggleSelect(item)"
            >
              <UIcon
                :name="isSelected(item.id) ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                class="text-xl"
                :class="isSelected(item.id) ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'"
              />
            </button>

            <!-- 文件：左键直接预览，右键弹出菜单（预览 / 下载） -->
            <UContextMenu
              v-if="item.type === 'file'"
              :items="fileMenuItems(item)"
              class="w-full h-full flex flex-col items-center"
            >
              <template #content-top>
                <!-- 与主界面一致的右键文件信息头 -->
                <MenuFileHeader
                  :item="menuHeaderItem(item)"
                  :selected-count="selected.size"
                  :get-children="getLocalChildren"
                />
              </template>
              <div
                class="w-full flex flex-col items-center gap-1 cursor-pointer rounded"
                @click="previewFile(item)"
              >
                <!-- 缩略图 / 图标区（图片直连不缓存，视频用 cache=false 截帧） -->
                <div class="w-full flex items-center justify-center overflow-hidden rounded-md h-16">
                  <img
                    v-if="isImage(item)"
                    :src="thumbUrl(item)"
                    :alt="item.name"
                    loading="lazy"
                    class="max-w-full max-h-full object-contain"
                  >
                  <VideoThumbnail
                    v-else-if="isVideoFile(item)"
                    :id="item.id"
                    :src="thumbUrl(item)"
                    :alt="item.name"
                    :content-type="item.contentType"
                    loading="lazy"
                    :cache="false"
                    class="w-full h-full max-w-full max-h-full"
                  />
                  <UIcon
                    v-else
                    :name="fileIcon(item.name)"
                    class="text-5xl text-gray-400"
                  />
                </div>
                <span class="leading-tight text-center line-clamp-2 overflow-hidden h-[2lh] max-w-full break-all shrink-0 text-[0.75rem]">
                  {{ item.name }}
                </span>
              </div>
            </UContextMenu>

            <!-- 文件夹：点击进入，右键打包下载 -->
            <UContextMenu
              v-else
              :items="folderMenuItems(item)"
              class="w-full h-full flex flex-col items-center"
            >
              <template #content-top>
                <MenuFileHeader
                  :item="menuHeaderItem(item)"
                  :selected-count="selected.size"
                  :get-children="getLocalChildren"
                />
              </template>
              <div
                class="w-full flex flex-col items-center gap-1 cursor-pointer rounded"
                @click="enterFolder(item)"
              >
                <div class="w-full flex items-center justify-center overflow-hidden rounded-md h-16">
                  <UIcon
                    name="fluent-emoji:file-folder"
                    class="text-5xl"
                  />
                </div>
                <span class="leading-tight text-center line-clamp-2 overflow-hidden h-[2lh] max-w-full break-all shrink-0 text-[0.75rem]">
                  {{ item.name }}
                </span>
              </div>
            </UContextMenu>
          </div>
        </div>

        <!-- 列表视图（UTable，与主界面一致；多选时显示复选框列） -->
        <UTable
          v-else
          v-model:row-selection="rowSelection"
          :data="items"
          :columns="listColumns"
          :get-row-id="rowIdGetter"
          class="flex-1"
          @select="onListSelect"
        />
      </template>
    </main>

    <!-- 文件预览（与主页一致的预览机制） -->
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
import JSZip from 'jszip'
import { h, resolveComponent, onBeforeUnmount } from 'vue'
import { fileIcon } from '~/utils/fileIcons'
import { LazyConfirmModal } from '#components'

definePageMeta({ layout: false })

const { t, locale, locales, setLocale } = useI18n()
const toast = useToast()
const route = useRoute()
const token = String(route.params.token)

interface ShareInfo {
  token: string
  expiresAt: number | null
  hasPassword: boolean
  createdAt: number
  items: { id: string, type: 'file' | 'folder', name: string }[]
}
interface ListItem {
  id: string
  type: 'file' | 'folder'
  name: string
  size?: number
  contentType?: string
}

const loading = ref(true)
const error = ref('')
const share = ref<ShareInfo | null>(null)
const authorized = ref(false)
const pinValue = ref<string[]>([])
const pwdError = ref('')
const verifying = ref(false)

// 分享完整索引（一次拉取，层级变化全部本地运算，与主界面一致）
const indexFolders = ref<{ id: string, parentId: string | null, name: string }[]>([])
const indexFiles = ref<{ id: string, folderId: string | null, name: string, size?: number, contentType?: string }[]>([])
// 当前文件夹（null = 分享顶层）
const currentFolderId = ref<string | null>(null)

/** 本地按 parentId 计算某文件夹的子项（文件夹 + 文件） */
function getLocalChildren(parentId: string | null): ListItem[] {
  const folders = indexFolders.value
    .filter(f => (f.parentId ?? null) === parentId)
    .map(f => ({ id: f.id, type: 'folder' as const, name: f.name }))
  const files = indexFiles.value
    .filter(f => (f.folderId ?? null) === parentId)
    .map(f => ({ id: f.id, type: 'file' as const, name: f.name, size: f.size, contentType: f.contentType }))
  return [...folders, ...files]
}
const items = computed<ListItem[]>(() => getLocalChildren(currentFolderId.value))

// 多选状态
const selected = ref<Set<string>>(new Set())
const zipping = ref(false)
const allSelected = computed(() => items.value.length > 0 && items.value.every(i => selected.value.has(i.id)))

// 视图切换（宫格 / 列表）
const viewMode = ref<'grid' | 'list'>('grid')

// 缩略图判断（分享页默认开启；图片直连不缓存，视频用 cache=false 截帧）
function fileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || ''
}
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'heic', 'heif', 'tiff', 'tif', 'raw', 'psd']
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'webm', 'flv', '3gp', 'm4v', 'mpeg', 'mpg', 'ogv', 'divx']
function isImage(item: ListItem): boolean {
  return item.type === 'file' && IMAGE_EXTS.includes(fileExt(item.name))
}
function isVideoFile(item: ListItem): boolean {
  return item.type === 'file' && VIDEO_EXTS.includes(fileExt(item.name))
}
function thumbUrl(item: ListItem): string {
  return `/api/share/${token}/download?fileId=${item.id}&inline=1`
}

/** 右键菜单信息头用的展示项（补齐图标/颜色/rawSize，与主界面 MenuFileHeader 字段一致） */
function menuHeaderItem(item: ListItem) {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    size: item.size,
    icon: item.type === 'folder' ? 'fluent-emoji:file-folder' : fileIcon(item.name),
    iconColor: item.type === 'folder' ? 'text-amber-500' : 'text-gray-400',
    rawSize: item.size
  }
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}

function isSelected(id: string): boolean {
  return selected.value.has(id)
}

function toggleSelect(item: ListItem) {
  if (selected.value.has(item.id)) {
    selected.value.delete(item.id)
  } else {
    selected.value.add(item.id)
  }
  selected.value = new Set(selected.value)
}

function clearSelection() {
  selected.value = new Set()
}

function toggleSelectAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(items.value.map(i => i.id))
  }
}

async function loadIndex() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ folders: any[], files: any[] }>(`/api/share/${token}/all`)
    indexFolders.value = res.folders || []
    indexFiles.value = res.files || []
    currentFolderId.value = null
    pathStack.value = []
    selected.value = new Set()
  } catch (e: any) {
    if (e?.status === 401) {
      // 需要密码
      authorized.value = false
    } else {
      error.value = e?.data?.message || t('app.shareLoadFailed')
    }
  } finally {
    loading.value = false
  }
}

async function init() {
  loading.value = true
  try {
    const res = await $fetch<ShareInfo>(`/api/share/${token}`)
    share.value = res
    // 有密码：尝试用已有的 share_ok cookie 授权加载索引；
    // 若 401（未授权）则 loadIndex 会显示密码输入框；成功则直接进入
    authorized.value = true
    await loadIndex()
    // 若 401，loadIndex 内已把 authorized 置为 false
  } catch (e: any) {
    // 非 401 错误（401 已由 loadIndex 处理）
    if (e?.status !== 401) {
      error.value = e?.data?.message || t('app.shareLoadFailed')
    }
  } finally {
    loading.value = false
  }
}

async function verify() {
  pwdError.value = ''
  verifying.value = true
  try {
    await $fetch(`/api/share/${token}/verify`, {
      method: 'POST',
      body: { password: pinValue.value.join('') }
    })
    authorized.value = true
    await loadIndex()
  } catch (e: any) {
    pwdError.value = e?.data?.message || t('app.shareWrongPassword')
  } finally {
    verifying.value = false
  }
}

function enterFolder(item: ListItem) {
  pathStack.value.push({ id: item.id, name: item.name })
  currentFolderId.value = item.id
  selected.value = new Set()
}

// 路径栏：分享目录（index 0）> 子文件夹
const pathStack = ref<{ id: string, name: string }[]>([])
const breadcrumbs = computed(() => [
  { id: null, name: t('app.shareRootDir') },
  ...pathStack.value
])
function goToBreadcrumb(index: number) {
  // index 0 = 分享目录，index > 0 = pathStack[index-1]
  if (index <= 0) {
    pathStack.value = []
    currentFolderId.value = null
  } else if (index <= pathStack.value.length) {
    pathStack.value = pathStack.value.slice(0, index)
    currentFolderId.value = pathStack.value[index - 1]?.id ?? null
  }
  selected.value = new Set()
}

// ===== 文件预览（与主页一致的 FileViewer 模态框，非新开标签页） =====
const { loadPreview } = useFileCache()
const showPreview = ref(false)
const previewFileData = ref<{ url: string, name: string } | null>(null)
const previewObjectUrl = ref<string | null>(null)

function previewFile(item: ListItem) {
  // 优先本地缓存，未命中则下载并写入缓存（与主页一致）
  loadPreview({
    id: item.id,
    name: item.name,
    contentType: item.contentType || '',
    apiUrl: `/api/share/${token}/download?fileId=${item.id}&inline=1`
  }).then((url) => {
    previewObjectUrl.value = url.startsWith('blob:') ? url : null
    previewFileData.value = { url, name: item.name }
    showPreview.value = true
  }).catch(() => {
    // 预览失败忽略
  })
}

function closePreview() {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = null
  }
  showPreview.value = false
  previewFileData.value = null
}

function downloadFile(item: ListItem) {
  window.open(`/api/share/${token}/download?fileId=${item.id}`, '_blank')
}

/** 下载单个项：文件直接下载；文件夹递归打包为 zip（{文件夹名}.zip） */
async function downloadItem(item: ListItem) {
  if (item.type === 'file') {
    downloadFile(item)
    return
  }
  zipping.value = true
  try {
    const zip = new JSZip()
    const folder = zip.folder(item.name)
    if (folder) {
      const children = getLocalChildren(item.id)
      for (const child of children) {
        await addToZip(folder, child, '')
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.name}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: t('app.shareZipFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    zipping.value = false
  }
}

/** 文件点击菜单：预览 / 下载 */
function fileMenuItems(item: ListItem): any[][] {
  return [
    [
      { label: t('app.preview'), icon: 'i-lucide-eye', onSelect: () => previewFile(item) },
      { label: t('app.download'), icon: 'i-lucide-download', onSelect: () => downloadFile(item) }
    ]
  ]
}

/** 文件夹右键菜单：打开 / 打包下载 */
function folderMenuItems(item: ListItem): any[][] {
  return [
    [
      { label: t('app.open'), icon: 'i-lucide-folder', onSelect: () => enterFolder(item) }
    ],
    [
      { label: t('app.shareDownloadZip'), icon: 'i-lucide-archive', onSelect: () => downloadItem(item) }
    ]
  ]
}

// 语言切换（与主界面一致）
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

// 列表视图列（与主界面外观一致：文件名缩略图 + 大小 + 操作；多选时前置复选框列）
const rowIdGetter = (row: any) => row.id
const rowSelection = computed<Record<string, boolean>>({
  get: () => Object.fromEntries(Array.from(selected.value).map(id => [id, true])),
  set: (val) => { selected.value = new Set(Object.keys(val || {}).filter(k => val[k])) }
})
// “部分但非全部”选中（表头全选时显示勾选而非半选）
const someRowsSelected = computed(() => {
  const sel = items.value.filter(i => selected.value.has(i.id)).length
  return sel > 0 && sel < items.value.length
})
// 表头全选/取消（value 来自 UCheckbox 的布尔值）
function onToggleAll(value: boolean) {
  selected.value = value ? new Set(items.value.map(i => i.id)) : new Set()
}

// 列表视图列（与主界面外观一致：文件名缩略图 + 大小 + 操作；多选时前置复选框列）
// 关键：用「构建函数 + 引用缓存」，仅当「是否显示复选框列」或语言变化时才重建数组；
// 选中数量变化不改变数组引用，从而避免 UTable 重建导致行内 VideoThumbnail 等组件
// 重新挂载（缩略图重新加载转圈）。
function buildListColumns(showSelect: boolean) {
  const selectCol = {
    id: 'select',
    header: () => h(resolveComponent('UCheckbox'), {
      modelValue: someRowsSelected.value ? 'indeterminate' : allSelected.value,
      'onUpdate:modelValue': (value: boolean) => onToggleAll(!!value),
      'aria-label': 'Select all'
    }),
    cell: ({ row }: any) => h(resolveComponent('UCheckbox'), {
      modelValue: row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean) => row.toggleSelected(!!value),
      'aria-label': 'Select row'
    }),
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-10 text-center', td: 'w-10 text-center' } }
  }
  const base = [
    {
      accessorKey: 'name',
      header: t('app.fileName'),
      minSize: 200,
      meta: { class: { td: 'truncate max-w-0 w-full' } },
      cell: ({ row }: any) => {
        const item = row.original
        let thumb
        if (item.type === 'folder') {
          thumb = h(resolveComponent('UIcon'), { name: 'fluent-emoji:file-folder', class: 'text-xl shrink-0' })
        } else if (isImage(item)) {
          thumb = h('img', { src: thumbUrl(item), alt: item.name, loading: 'lazy', class: 'h-9 w-9 shrink-0 object-contain rounded' })
        } else if (isVideoFile(item)) {
          thumb = h(resolveComponent('VideoThumbnail'), {
            id: item.id,
            src: thumbUrl(item),
            alt: item.name,
            contentType: item.contentType,
            loading: 'lazy',
            cache: false,
            class: 'h-9 w-9 shrink-0 rounded'
          })
        } else {
          thumb = h(resolveComponent('UIcon'), { name: fileIcon(item.name), class: 'text-xl shrink-0 text-gray-400' })
        }
        return h('div', { class: 'flex items-center gap-2 truncate' }, [
          thumb,
          h('span', { class: 'truncate' }, item.name)
        ])
      }
    },
    {
      accessorKey: 'size',
      header: t('app.size'),
      meta: { class: { th: 'hidden md:table-cell min-w-[95px] text-right', td: 'hidden md:table-cell min-w-[95px] text-right text-sm text-gray-500' } },
      cell: ({ row }: any) => formatSize(row.original.size) || ''
    },
    {
      id: 'actions',
      header: t('app.actions'),
      enableSorting: false,
      meta: { class: { th: 'w-11 md:min-w-[110px] text-right', td: 'w-11 md:min-w-[110px] text-right' } },
      cell: ({ row }: any) => {
        const item = row.original
        const isFolder = item.type === 'folder'
        return h('div', { class: 'flex items-center justify-end gap-0.5' }, [
          h(resolveComponent('UButton'), {
            // 文件夹与文件统一使用下载图标（文件夹点击为打包下载）
            'icon': 'i-lucide-download',
            'color': 'neutral',
            'variant': 'ghost',
            'size': 'sm',
            'aria-label': t('app.download'),
            'onClick': () => (isFolder ? downloadItem(item) : downloadFile(item))
          })
        ])
      }
    }
  ]
  return showSelect ? [selectCol, ...base] : base
}
let listColumnsCache: { key: string, value: any[] } | null = null
const listColumns = computed(() => {
  const showSelect = selected.value.size > 0
  const key = `${showSelect}|${locale.value}`
  if (listColumnsCache && listColumnsCache.key === key) return listColumnsCache.value
  const cols = buildListColumns(showSelect)
  listColumnsCache = { key, value: cols }
  return cols
})

function onListSelect(_e: Event, row: any) {
  const item = row.original
  if (item.type === 'folder') enterFolder(item)
  else previewFile(item)
}

// ===== 长按多选 + 框选多选（与主界面一致） =====
let rubberStart: { x: number, y: number } | null = null
let rubberMoved = false
let rubberItemRects: { id: string, rect: DOMRect }[] = []
let rubberLastX = 0
let rubberLastY = 0
let rubberFrame = 0
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let suppressClick = false
const rubberBand = ref<{ x: number, y: number, w: number, h: number } | null>(null)
const rubberDragging = ref(false) // 拖拽中（禁用浏览器文字选中）

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

/** 由列表行 DOM 反查 item id（tbody 行按顺序对应 items） */
function getRowId(tr: Element): string | null {
  const tbody = tr.closest('tbody')
  if (!tbody) return null
  const rows = Array.from(tbody.querySelectorAll('tr[data-slot="tr"]'))
  const idx = rows.indexOf(tr)
  return items.value[idx]?.id ?? null
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  rubberMoved = false
  const target = e.target as HTMLElement
  // 交互控件（按钮/输入/复选框/菜单项等）不启动
  if (target.closest('button, a, input, select, textarea, [role="checkbox"], [role="menuitem"], [role="menuitemcheckbox"]')) return
  // 表头 / 分隔线不启动
  if (target.closest('table thead, tr[data-slot="separator"]')) return
  rubberDragging.value = true
  // 长按（~450ms 不移动）进入多选
  const itemEl = target.closest('[data-grid-item]') as HTMLElement | null
  const rowEl = target.closest('main table tbody tr[data-slot="tr"]') as HTMLElement | null
  const id = itemEl ? itemEl.getAttribute('data-id') : (rowEl ? getRowId(rowEl) : null)
  if (id) {
    clearLongPress()
    longPressTimer = setTimeout(() => {
      if (!selected.value.has(id)) {
        const s = new Set(selected.value)
        s.add(id)
        selected.value = s
      }
      suppressClick = true
    }, 450)
  }
  rubberStart = { x: e.clientX, y: e.clientY }
  rubberItemRects = []
  window.addEventListener('pointermove', onRubberMove)
  window.addEventListener('pointerup', onRubberUp)
  window.addEventListener('pointercancel', onRubberUp)
  window.addEventListener('blur', onRubberUp)
  window.addEventListener('click', onRubberClickCapture, true)
}

function onRubberMove(e: PointerEvent) {
  if (!rubberStart) return
  rubberLastX = e.clientX
  rubberLastY = e.clientY
  // 移动超过阈值：取消长按（进入框选）
  if (longPressTimer && (Math.abs(rubberLastX - rubberStart.x) > 10 || Math.abs(rubberLastY - rubberStart.y) > 10)) {
    clearLongPress()
  }
  if (rubberFrame) return
  rubberFrame = requestAnimationFrame(updateRubber)
}

function updateRubber() {
  rubberFrame = 0
  if (!rubberStart) return
  const dx = rubberLastX - rubberStart.x
  const dy = rubberLastY - rubberStart.y
  // 2px 阈值：首次框选时收集目标矩形，并清除浏览器文字选中
  if (!rubberMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
    rubberMoved = true
    window.getSelection()?.removeAllRanges()
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
    if (rect.left < x + w && rect.right > x && rect.top < y + h && rect.bottom > y) s.add(id)
  }
  selected.value = s
}

/** 收集当前视图可被框选的目标矩形（宫格项 / 列表行） */
function getRubberItems(): { id: string, rect: DOMRect }[] {
  if (viewMode.value === 'grid') {
    return Array.from(document.querySelectorAll('main [data-grid-item]')).map(el => ({
      id: el.getAttribute('data-id')!,
      rect: el.getBoundingClientRect()
    }))
  }
  const tbody = document.querySelector('main table tbody')
  if (!tbody) return []
  const trs = Array.from(tbody.querySelectorAll('tr[data-slot="tr"]'))
  return trs
    .map((tr, i) => ({ id: items.value[i]?.id ?? '', rect: tr.getBoundingClientRect() }))
    .filter(x => !!x.id)
}

/** 捕获阶段拦截点击：框选/长按后阻止该次点击触发预览/进入（处理一次自移除） */
function onRubberClickCapture(e: MouseEvent) {
  if (rubberMoved || suppressClick) {
    e.preventDefault()
    e.stopPropagation()
  }
  suppressClick = false
  window.removeEventListener('click', onRubberClickCapture, true)
}

function onRubberUp() {
  // 若有未执行的帧，先同步处理最后一次移动，避免最后的选择丢失
  if (rubberFrame) {
    rubberFrame = 0
    updateRubber()
  }
  window.removeEventListener('pointermove', onRubberMove)
  window.removeEventListener('pointerup', onRubberUp)
  window.removeEventListener('pointercancel', onRubberUp)
  window.removeEventListener('blur', onRubberUp)
  clearLongPress()
  rubberBand.value = null
  rubberStart = null
  rubberItemRects = []
  rubberDragging.value = false
}

onBeforeUnmount(() => {
  clearLongPress()
  window.removeEventListener('pointermove', onRubberMove)
  window.removeEventListener('pointerup', onRubberUp)
  window.removeEventListener('pointercancel', onRubberUp)
  window.removeEventListener('blur', onRubberUp)
  window.removeEventListener('click', onRubberClickCapture, true)
})

/** 递归把分享项加入 zip（文件直接拉取，文件夹递归其子项） */
async function addToZip(zip: JSZip, item: ListItem, prefix: string) {
  if (item.type === 'file') {
    const res = await fetch(`/api/share/${token}/download?fileId=${item.id}`)
    if (!res.ok) throw new Error(`下载失败: ${item.name}`)
    const blob = await res.blob()
    zip.file(prefix + item.name, blob)
  } else {
    const folder = zip.folder(prefix + item.name)
    if (!folder) return
    // 用本地索引递归子项，避免打包时逐个请求
    const children = getLocalChildren(item.id)
    for (const child of children) {
      await addToZip(folder, child, '')
    }
  }
}

/** 批量打包下载选中项（带二次确认框） */
async function confirmDownload() {
  const chosen = items.value.filter(i => selected.value.has(i.id))
  if (!chosen.length) return
  const first = chosen[0]?.name ?? ''
  const message = chosen.length > 1
    ? t('app.confirmDownloadBatch', { first, count: chosen.length })
    : t('app.confirmDownloadOne', { name: first })
  const overlay = useOverlay()
  overlay.create(LazyConfirmModal).open({
    title: t('app.shareDownloadZip'),
    message,
    icon: 'i-lucide-archive',
    confirmColor: 'primary',
    confirmLabel: t('app.download'),
    list: chosen.map(i => ({ name: i.name, type: i.type })),
    onConfirm: async () => { await downloadSelected() }
  })
}

async function downloadSelected() {
  if (selected.value.size === 0) return
  zipping.value = true
  try {
    const zip = new JSZip()
    const chosen = items.value.filter(i => selected.value.has(i.id))
    for (const item of chosen) {
      await addToZip(zip, item, '')
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // zip 文件名 = 分享链接中的 token，如 5EyaWjLXAn.zip
    a.download = `${token}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: t('app.shareZipFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    zipping.value = false
  }
}

onMounted(init)
</script>
