<script setup lang="ts">
/**
 * 右键 / 操作菜单顶部的文件信息头（图标、名称、修改时间、大小；多选时显示已选数量）。
 * 网格右键、列表右键、列表 ⋯ 操作菜单三处共用，保证各菜单顶部信息一致。
 */
import { useI18n } from '#imports'

const props = defineProps<{
  item: any
  /** 当前选中数量（>1 时显示多选信息头） */
  selectedCount: number
  /** 取子项列表（文件夹时显示包含文件数） */
  getChildren: (id: string) => any[]
}>()

const { t } = useI18n()

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

<template>
  <div
    v-if="item"
    class="px-3 py-2 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 min-w-60"
  >
    <template v-if="selectedCount <= 1">
      <UIcon
        :name="item.icon || 'i-lucide-file'"
        :class="['text-3xl shrink-0', item.iconColor || 'text-gray-400']"
      />
      <div class="min-w-0">
        <p class="text-sm font-medium wrap-break-word">
          {{ item.name }}
        </p>
        <p
          v-if="formatDate(item.modified)"
          class="text-xs text-gray-400 mt-0.5"
        >
          {{ formatDate(item.modified) }}
        </p>
        <p class="text-xs text-gray-400 mt-0.5">
          <span v-if="item.type === 'file'">{{ formatSize(item.rawSize ?? 0) }}</span>
          <span v-else>{{ t('app.containsFiles', { count: getChildren(item.id).length }) }}</span>
        </p>
      </div>
    </template>
    <template v-else>
      <UIcon
        name="i-lucide-copy-check"
        class="text-3xl text-gray-400 shrink-0"
      />
      <p class="text-sm">
        {{ t('app.selectedCount', { count: selectedCount }) }}
      </p>
    </template>
  </div>
</template>
