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
      <span class="text-xs text-gray-400">
        {{ t('app.sharePageTag') }}
      </span>
    </header>

    <main class="max-w-4xl mx-auto p-4">
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
        <!-- 工具栏：全选 / 已选计数 / 打包下载 -->
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
              @click="downloadSelected"
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

        <!-- 网格 -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div
            v-for="item in items"
            :key="item.id"
            class="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex flex-col items-center gap-2 transition-colors"
            :class="isSelected(item.id) ? 'ring-2 ring-blue-400' : ''"
          >
            <!-- 勾选按钮 -->
            <button
              class="absolute top-1.5 left-1.5 z-10"
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
              <div
                class="w-full flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded"
                @click="previewFile(item)"
              >
                <UIcon
                  name="i-lucide-file"
                  class="text-4xl text-gray-400"
                />
                <span class="text-xs text-center break-all line-clamp-2 w-full">{{ item.name }}</span>
                <span class="text-[0.65rem] text-gray-400">
                  {{ formatSize(item.size) }}
                </span>
              </div>
            </UContextMenu>

            <!-- 文件夹：点击进入 -->
            <div
              v-else
              class="w-full flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded"
              @click="enterFolder(item)"
            >
              <UIcon
                name="i-lucide-folder"
                class="text-4xl text-amber-500"
              />
              <span class="text-xs text-center break-all line-clamp-2 w-full">{{ item.name }}</span>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import JSZip from 'jszip'

definePageMeta({ layout: false })

const { t } = useI18n()
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

const items = ref<ListItem[]>([])
// 当前文件夹（null = 分享顶层）；进入文件夹后保持在当前层级
const currentFolderId = ref<string | null>(null)

// 多选状态
const selected = ref<Set<string>>(new Set())
const zipping = ref(false)
const allSelected = computed(() => items.value.length > 0 && items.value.every(i => selected.value.has(i.id)))

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

async function loadList(parentId: string | null = null) {
  loading.value = true
  error.value = ''
  try {
    const url = `/api/share/${token}/list${parentId ? `?parentId=${parentId}` : ''}`
    const res = await $fetch<{ parentId: string | null, items: ListItem[] }>(url)
    items.value = res.items || []
    // 切换目录时清空选中
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
    // 有密码：尝试用已有的 share_ok cookie 授权加载；
    // 若 401（未授权）则 loadList 会显示密码输入框；成功则直接进入
    authorized.value = true
    await loadList(null)
    // 若 401，loadList 内已把 authorized 置为 false
  } catch (e: any) {
    // 非 401 错误（401 已由 loadList 处理）
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
    await loadList(null)
  } catch (e: any) {
    pwdError.value = e?.data?.message || t('app.shareWrongPassword')
  } finally {
    verifying.value = false
  }
}

function enterFolder(item: ListItem) {
  currentFolderId.value = item.id
  loadList(item.id)
}

function previewFile(item: ListItem) {
  window.open(`/api/share/${token}/download?fileId=${item.id}&inline=1`, '_blank')
}

function downloadFile(item: ListItem) {
  window.open(`/api/share/${token}/download?fileId=${item.id}`, '_blank')
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
    const res = await $fetch<{ items: ListItem[] }>(`/api/share/${token}/list?parentId=${item.id}`)
    for (const child of res.items) {
      await addToZip(folder, child, '')
    }
  }
}

/** 批量打包下载选中项 */
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
    a.download = '分享下载.zip'
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
