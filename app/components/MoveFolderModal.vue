<script setup lang="ts">
/**
 * 移动目标文件夹选择器：面包屑 + 子文件夹列表导航，选择当前所在文件夹作为移动目标
 * 关闭时返回 { id, name }（null 表示根目录）；取消返回 null
 */
const { t } = useI18n()
const emit = defineEmits<{ close: [target: { id: string | null, name: string } | null] }>()

// 由父级传入已加载的索引访问器（避免独立实例未同步）
const props = defineProps<{
  getChildren: (parentId: string | null) => { id: string, type: string, name: string }[]
  getItem: (id: string) => { name: string } | undefined
}>()

// 导航路径（null = 根目录）
const path = ref<(string | null)[]>([null])
const currentId = computed(() => path.value[path.value.length - 1] ?? null)
const crumbs = computed(() => path.value.map((id) => ({
  id,
  name: id === null ? t('app.root') : (props.getItem(id)?.name || '')
})))
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
</script>

<template>
  <UModal :title="t('app.moveTo')">
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
      <div class="flex justify-end gap-2">
        <UButton
          variant="ghost"
          :label="t('app.cancel')"
          @click="cancel"
        />
        <UButton
          color="primary"
          icon="i-lucide-folder-input"
          :label="t('app.moveHere')"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
