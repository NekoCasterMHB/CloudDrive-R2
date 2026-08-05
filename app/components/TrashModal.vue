<script setup lang="ts">
import { LazyConfirmModal, LazyMoveFolderModal } from '#components'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ close: [] }>()

const props = defineProps<{
  onRestored?: (record?: any) => void
  /** 还原位置选择器所需：目录索引访问器（由主页面传入） */
  getChildren?: (parentId: string | null) => { id: string, type: string, name: string }[]
  getItem?: (id: string) => { name: string } | undefined
  /** 新建文件夹（还原位置选择器内「新建文件夹」按钮），由主页面传入 */
  createFolder?: (name: string, parentId: string | null) => Promise<{ id: string, name: string } | null>
}>()

const viewMode = ref<'grid' | 'list'>('list')

const trashItems = ref<any[]>([])
const trashLoading = ref(true)

// 层级浏览状态：当前所在路径段（[] = 回收站根层）
const currentPath = ref<string[]>([])

interface TrashNode {
  name: string
  type: 'folder' | 'file'
  path: string[]
  item?: any // 对应回收站记录（合成文件夹节点可能无）
  children: TrashNode[]
  size: number
}

/** 基于 originalPath 构建回收站树（自动合成缺失的文件夹层级，兼容历史数据） */
function buildTree(items: any[]): TrashNode[] {
  const roots: TrashNode[] = []
  const map = new Map<string, TrashNode>()
  const getFolder = (path: string[], name: string): TrashNode => {
    const key = path.join('/')
    let node = map.get(key)
    if (!node) {
      node = { name, type: 'folder', path, children: [], size: 0 }
      map.set(key, node)
      if (path.length > 1) {
        getFolder(path.slice(0, -1), path[path.length - 2]).children.push(node)
      } else {
        roots.push(node)
      }
    }
    return node
  }
  for (const item of items) {
    const segs = (item.originalPath ? item.originalPath.split('/') : [item.name]).filter(Boolean)
    const name = segs[segs.length - 1] || item.name
    const path = segs
    if (item.isFolder) {
      const node = getFolder(path, name)
      node.item = item
      node.type = 'folder'
      node.size = item.size || 0
    } else {
      const key = path.join('/')
      let node = map.get(key)
      if (!node) {
        node = { name, type: 'file', path, children: [], size: item.size || 0, item }
        map.set(key, node)
        if (path.length > 1) {
          getFolder(path.slice(0, -1), path[path.length - 2]).children.push(node)
        } else {
          roots.push(node)
        }
      }
    }
  }
  // 计算文件夹聚合大小（含子孙文件）
  const calc = (n: TrashNode): number => {
    let s = n.type === 'file' ? n.size : 0
    for (const c of n.children) s += calc(c)
    n.size = s
    return s
  }
  for (const r of roots) calc(r)
  return roots
}

const tree = computed(() => buildTree(trashItems.value))

/** 当前层节点列表 */
const currentNodes = computed<TrashNode[]>(() => {
  let nodes = tree.value
  for (const seg of currentPath.value) {
    const next = nodes.find(n => n.type === 'folder' && n.name === seg)
    if (!next) return []
    nodes = next.children
  }
  return nodes
})

/** 校验路径段是否仍存在（还原/删除后可能失效） */
function pathValid(path: string[]): boolean {
  let nodes = tree.value
  for (const seg of path) {
    const next = nodes.find(n => n.type === 'folder' && n.name === seg)
    if (!next) return false
    nodes = next.children
  }
  return true
}

/** 进入文件夹（精确到文件层级浏览） */
function openFolder(node: TrashNode) {
  if (node.type === 'folder') currentPath.value = [...currentPath.value, node.name]
}

async function loadTrash() {
  trashLoading.value = true
  try {
    const res = await $fetch<any>('/api/trash')
    trashItems.value = (res.items || []).map((t: any) => ({
      ...t,
      deletedAt: new Date(t.deletedAt).getTime(),
      expiresAt: new Date(t.expiresAt).getTime(),
      expiresDays: Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 86400000))
    }))
    // 刷新后校验当前路径，失效则逐级回退（如所浏览文件夹已被还原/删除）
    while (currentPath.value.length > 0 && !pathValid(currentPath.value)) {
      currentPath.value = currentPath.value.slice(0, -1)
    }
  } catch {
    trashItems.value = []
  } finally {
    trashLoading.value = false
  }
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function formatSize(bytes?: number): string {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}

async function restoreItem(item: any) {
  try {
    let res = await $fetch<any>(`/api/trash/${item.id}/restore`, { method: 'POST' })
    // 原路径已不存在 → 弹「还原到」选择器，让用户选择还原位置
    if (res?.needsTarget) {
      if (!props.getChildren || !props.getItem) {
        toast.add({ title: t('app.failed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 })
        return
      }
      const overlay = useOverlay()
      const target = await overlay.create(LazyMoveFolderModal).open({
        getChildren: props.getChildren,
        getItem: props.getItem,
        title: t('app.restoreTo'),
        confirmLabel: t('app.restoreHere'),
        createFolder: props.createFolder
      })
      if (!target) return // 用户取消，不还原
      res = await $fetch<any>(`/api/trash/${item.id}/restore`, {
        method: 'POST',
        body: { targetFolderId: target.id }
      })
    }
    toast.add({ title: `${item.name} ${t('app.restore')}`, icon: 'i-lucide-rotate-ccw', duration: 2000 })
    loadTrash()
    props.onRestored?.(res)
  } catch { toast.add({ title: t('app.failed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 }) }
}

async function deleteForever(id: string) {
  try {
    await $fetch(`/api/trash/${id}`, { method: 'DELETE' })
    toast.add({ title: t('app.deleteForever'), icon: 'i-lucide-trash-2', duration: 2000 })
    loadTrash()
  } catch { toast.add({ title: t('app.failed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 }) }
}

/** 清空回收站：二次确认后永久删除所有记录与 R2 对象 */
async function clearTrash() {
  const overlay = useOverlay()
  await overlay.create(LazyConfirmModal).open({
    title: t('app.emptyTrash'),
    message: t('app.confirmEmptyTrash'),
    icon: 'i-lucide-trash-2',
    confirmLabel: t('app.emptyTrash'),
    confirmColor: 'error',
    onConfirm: async () => {
      try {
        const res = await $fetch<any>('/api/trash/clear', { method: 'DELETE' })
        if (res?.failedCount > 0) {
          // 部分 R2 对象删除失败：保留记录以便重试，提示用户
          toast.add({ title: t('app.trashClearPartial'), color: 'error', icon: 'i-lucide-alert-triangle', duration: 3500 })
          loadTrash()
        } else {
          toast.add({ title: t('app.emptyTrash'), icon: 'i-lucide-trash-2', duration: 2000 })
          trashItems.value = []
          currentPath.value = []
        }
        props.onRestored?.()
      } catch { toast.add({ title: t('app.failed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 }) }
    }
  })
}

onMounted(loadTrash)
</script>

<template>
  <UModal class="max-w-2xl">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-trash-2"
            class="text-lg text-gray-500"
          />
          <span class="font-semibold">{{ $t('app.trash') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <UTooltip :text="$t('app.emptyTrash')">
            <UButton
              v-if="trashItems.length > 0"
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="ghost"
              :label="$t('app.emptyTrash')"
              @click="clearTrash"
            />
          </UTooltip>
          <UTooltip :text="$t('app.grid')">
            <UButton
              :icon="viewMode === 'grid' ? 'i-lucide-layout-grid' : 'i-lucide-list'"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'"
            />
          </UTooltip>
          <UButton
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          />
        </div>
      </div>
    </template>
    <template #body>
      <div
        v-if="trashLoading"
        class="flex justify-center py-10"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="text-2xl animate-spin text-gray-400"
        />
      </div>
      <template v-else-if="trashItems.length > 0">
        <!-- 面包屑：回收站 > 文件夹名 > ... -->
        <div class="flex items-center gap-1 px-1 pb-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            :label="$t('app.trash')"
            :disabled="currentPath.length === 0"
            @click="currentPath = []"
          />
          <template
            v-for="(seg, i) in currentPath"
            :key="i"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="text-gray-400 shrink-0"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :label="seg"
              :disabled="i === currentPath.length - 1"
              @click="currentPath = currentPath.slice(0, i + 1)"
            />
          </template>
        </div>

        <div
          v-if="viewMode === 'grid'"
          class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-80 overflow-auto p-1"
        >
          <div
            v-for="node in currentNodes"
            :key="node.path.join('/')"
            class="aspect-square rounded-lg bg-gray-50 dark:bg-gray-900 border flex flex-col items-center justify-center p-2 relative group"
            :class="node.type === 'folder' ? 'cursor-pointer hover:ring-2 hover:ring-primary/40' : ''"
            @click="openFolder(node)"
          >
            <UIcon
              :name="node.type === 'folder' ? 'i-lucide-folder' : 'i-lucide-file'"
              class="text-2xl text-gray-400"
            />
            <span class="text-xs mt-1 truncate w-full text-center">{{ node.name }}</span>
            <span class="text-[10px] text-gray-400">{{ formatSize(node.size) }}</span>
            <div class="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <template v-if="node.item">
                <UButton
                  icon="i-lucide-rotate-ccw"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :title="$t('app.restore')"
                  loading-auto
                  @click.stop="restoreItem(node.item)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  :title="$t('app.deleteForever')"
                  loading-auto
                  @click.stop="deleteForever(node.item.id)"
                />
              </template>
            </div>
            <UBadge
              v-if="node.item"
              size="xs"
              color="warning"
              class="absolute bottom-1 left-1"
            >
              {{ $t('app.remainingDays', { days: node.item.expiresDays }) }}
            </UBadge>
          </div>
        </div>
        <div
          v-else
          class="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-auto"
        >
          <div
            v-for="node in currentNodes"
            :key="node.path.join('/')"
            class="py-3 flex items-start gap-3"
            :class="node.type === 'folder' ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''"
            @click="openFolder(node)"
          >
            <UIcon
              :name="node.type === 'folder' ? 'i-lucide-folder' : 'i-lucide-file'"
              class="text-lg shrink-0 mt-0.5 text-gray-400"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate font-medium flex items-center gap-1">
                {{ node.name }}
                <UTooltip :text="node.item?.originalPath">
                  <UIcon
                    name="i-lucide-folder"
                    class="text-gray-400 shrink-0"
                  />
                </UTooltip>
              </p>
              <div class="flex gap-3 text-xs text-gray-400 mt-0.5">
                <span>{{ formatSize(node.size) }}</span>
                <span v-if="node.item">{{ $t('app.deletedAt') }}: {{ formatTime(node.item.deletedAt) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UBadge
                v-if="node.item"
                size="md"
                color="warning"
              >
                {{ $t('app.remainingDays', { days: node.item.expiresDays }) }}
              </UBadge>
              <template v-if="node.item">
                <UButton
                  icon="i-lucide-rotate-ccw"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :title="$t('app.restore')"
                  loading-auto
                  @click.stop="restoreItem(node.item)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  :title="$t('app.deleteForever')"
                  loading-auto
                  @click.stop="deleteForever(node.item.id)"
                />
              </template>
            </div>
          </div>
        </div>
      </template>
      <div
        v-else
        class="text-center text-gray-400 py-10 text-sm"
      >
        {{ $t('app.trashEmpty') }}
      </div>
    </template>
  </UModal>
</template>
