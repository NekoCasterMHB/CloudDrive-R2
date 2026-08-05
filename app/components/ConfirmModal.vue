<script setup lang="ts">
const { t } = useI18n()
const emit = defineEmits<{ close: [confirmed: boolean] }>()

export interface ConfirmListItem {
  name: string
  type?: 'file' | 'folder'
}

withDefaults(defineProps<{
  title: string
  message: string
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'error' | 'primary' | 'neutral'
  onConfirm?: () => Promise<void>
  /** 仅确认模式：隐藏取消按钮（用于纯提示） */
  hideCancel?: boolean
  /** 可选：清空回收站进度状态（响应式对象，删除期间在模态框内实时显示进度） */
  progressState?: { progress: { done: number, total: number } | null }
  /** 操作涉及的文件/文件夹列表（详细展示） */
  list?: ConfirmListItem[]
  /** 列表最多直接展示的条数，超出部分折叠显示 */
  listMax?: number
}>(), {
  icon: 'i-lucide-alert-triangle',
  confirmLabel: undefined,
  cancelLabel: undefined,
  confirmColor: 'error',
  onConfirm: undefined,
  hideCancel: false,
  progressState: undefined,
  list: undefined,
  listMax: 8
})
</script>

<template>
  <UModal :title="title">
    <template #body>
      <div class="flex gap-3">
        <UIcon
          v-if="icon"
          :name="icon"
          class="text-lg shrink-0 mt-0.5"
          :class="confirmColor === 'error' ? 'text-red-500' : ''"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ message }}
          </p>
          <!-- 清空回收站进度（删除期间实时显示，直到完成后模态框自动关闭） -->
          <div
            v-if="progressState?.progress"
            class="mt-3"
          >
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span class="inline-flex items-center gap-1">
                <UIcon
                  name="i-lucide-loader-circle"
                  class="size-3 animate-spin"
                />
                <span>{{ t('app.clearingTrash') }}</span>
              </span>
              <span v-if="progressState.progress.total > 0">{{ Math.round(progressState.progress.done / progressState.progress.total * 100) }}%</span>
            </div>
            <UProgress
              :model-value="progressState.progress.total > 0 ? (progressState.progress.done / progressState.progress.total) * 100 : 0"
              color="error"
            />
          </div>
          <div
            v-if="list && list.length"
            class="mt-3 max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800"
          >
            <div
              v-for="(item, i) in list.slice(0, listMax)"
              :key="i"
              class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <UIcon
                :name="item.type === 'folder' ? 'i-lucide-folder' : 'i-lucide-file'"
                class="shrink-0 text-gray-400 dark:text-gray-500"
              />
              <span class="truncate">{{ item.name }}</span>
            </div>
            <div
              v-if="list.length > listMax"
              class="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500"
            >
              {{ t('app.andMore', { count: list.length - listMax }) }}
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          v-if="!hideCancel"
          color="neutral"
          variant="outline"
          :label="cancelLabel || t('app.cancel')"
          @click="emit('close', false)"
        />
        <UButton
          :color="confirmColor"
          :label="confirmLabel || t('app.confirm')"
          loading-auto
          @click="async () => { if (onConfirm) await onConfirm(); emit('close', true) }"
        />
      </div>
    </template>
  </UModal>
</template>
