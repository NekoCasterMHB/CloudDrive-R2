<script setup lang="ts">
/**
 * 移动目标文件夹选择器：面包屑 + 子文件夹列表导航，选择当前所在文件夹作为移动目标
 * 关闭时返回 { id, name }（null 表示根目录）；取消返回 null
 */
const { t } = useI18n()
const emit = defineEmits<{ close: [target: { id: string | null, name: string } | null] }>()

// 由父级传入已加载的索引访问器（避免独立实例未同步）
const props = withDefaults(defineProps<{
  getChildren: (parentId: string | null) => { id: string, type: string, name: string }[]
  getItem: (id: string) => { name: string } | undefined
  /** 自定义标题（如「还原到」），默认「移动到」 */
  title?: string
  /** 确认按钮文案（如「还原到此」），默认「移动到此处」 */
  confirmLabel?: string
  /** 新建文件夹（可选）：在当前目录下创建并返回新文件夹 */
  createFolder?: (name: string, parentId: string | null) => Promise<{ id: string, name: string } | null>
}>(), { title: undefined, confirmLabel: undefined, createFolder: undefined })

// 导航路径（null = 根目录）
const path = ref<(string | null)[]>([null])
const currentId = computed(() => path.value[path.value.length - 1] ?? null)
const crumbs = computed(() => path.value.map((id) => ({
  id,
  name: id === null ? t('app.root') : (props.getItem(id)?.name || '')
})))

// 本地新建的文件夹（合并显示，无需等待索引刷新）
const showCreate = ref(false)
const newName = ref('')
const creating = ref(false)

// 直接读取索引（createFolderIn 已同步到索引），避免与本地缓存重复显示
const subFolders = computed(() => props.getChildren(currentId.value).filter(f => f.type === 'folder'))

function enterFolder(id: string) {
  path.value.push(id)
}
function goTo(index: number) {
  path.value = path.value.slice(0, index + 1)
}
function confirm() {
  const id = currentId.value
  emit('close', { id, name: id === null ? t('app.root') : (props.getItem(id)?.name || '') })
}
function cancel() {
  emit('close', null)
}

/** 在当前目录下新建文件夹，成功后立即显示并保持可选中 */
async function createNewFolder() {
  const name = newName.value.trim()
  if (!name || creating.value || !props.createFolder) return
  creating.value = true
  try {
    const res = await props.createFolder(name, currentId.value)
    if (res?.id) {
      newName.value = ''
      showCreate.value = false
    }
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <UModal :title="props.title || t('app.moveTo')">
    <template #body>
      <!-- 面包屑 -->
      <div class="mb-3 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-gray-500">
        <template
          v-for="(c, i) in crumbs"
          :key="c.id ?? '__root__'"
        >
          <UIcon
            v-if="i > 0"
            name="i-lucide-chevron-right"
            class="text-xs shrink-0"
          />
          <button
            class="shrink-0 truncate max-w-28 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            :class="i === crumbs.length - 1 ? 'text-gray-900 dark:text-gray-200 font-medium' : ''"
            @click="goTo(i)"
          >
            {{ c.name }}
          </button>
        </template>
      </div>
      <!-- 子文件夹列表 -->
      <div class="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        <button
          v-for="f in subFolders"
          :key="f.id"
          class="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="enterFolder(f.id)"
        >
          <UIcon
            name="i-lucide-folder"
            class="text-amber-500 shrink-0"
          />
          <span class="truncate flex-1">{{ f.name }}</span>
          <UIcon
            name="i-lucide-chevron-right"
            class="text-gray-400 shrink-0"
          />
        </button>
        <div
          v-if="subFolders.length === 0"
          class="px-3 py-6 text-center text-sm text-gray-400"
        >
          {{ t('app.noSubfolders') }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-between gap-2 w-full">
        <!-- 左侧：新建文件夹 -->
        <div class="flex items-center gap-2 min-w-0">
          <UInput
            v-if="showCreate"
            v-model="newName"
            :placeholder="t('app.folderName')"
            size="sm"
            class="w-40"
            @keyup.enter="createNewFolder"
          />
          <UButton
            v-if="showCreate"
            size="sm"
            color="primary"
            icon="i-lucide-check"
            :loading="creating"
            :disabled="!newName.trim()"
            @click="createNewFolder"
          />
          <UButton
            v-else-if="props.createFolder"
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-lucide-folder-plus"
            :label="t('app.newFolder')"
            @click="showCreate = true"
          />
        </div>
        <!-- 右侧：取消 / 确认 -->
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            variant="ghost"
            :label="t('app.cancel')"
            @click="cancel"
          />
          <UButton
            color="primary"
            icon="i-lucide-folder-input"
            :label="props.confirmLabel || t('app.moveHere')"
            @click="confirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
