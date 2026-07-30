<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ close: [] }>()

const props = defineProps<{
  onRestored?: () => void
}>()

const viewMode = ref<'grid' | 'list'>('list')

const trashItems = ref<any[]>([])
const trashLoading = ref(true)

async function loadTrash() {
  trashLoading.value = true
  try {
    const res = await $fetch<any>('/api/trash')
    trashItems.value = (res.items || []).map((t: any) => ({
      ...t,
      deletedAt: new Date(t.deletedAt).getTime(),
      expiresAt: new Date(t.expiresAt).getTime(),
      expiresDays: Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 86400000)),
    }))
  } catch { trashItems.value = [] }
  finally { trashLoading.value = false }
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
    await $fetch(`/api/trash/${item.id}/restore`, { method: 'POST' })
    toast.add({ title: `${item.name} ${t('app.restore')}`, icon: 'i-lucide-rotate-ccw', duration: 2000 })
    loadTrash()
    props.onRestored?.()
  } catch { toast.add({ title: t('app.failed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 }) }
}

async function deleteForever(id: string) {
  try {
    await $fetch(`/api/trash/${id}`, { method: 'DELETE' })
    toast.add({ title: t('app.deleteForever'), icon: 'i-lucide-trash-2', duration: 2000 })
    loadTrash()
  } catch { toast.add({ title: t('app.failed'), color: 'error', icon: 'i-lucide-circle-x', duration: 3000 }) }
}

onMounted(loadTrash)
</script>

<template>
  <UModal class="max-w-2xl">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-trash-2" class="text-lg text-gray-500" />
          <span class="font-semibold">{{ $t('app.trash') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <UTooltip :text="$t('app.grid')">
            <UButton :icon="viewMode === 'grid' ? 'i-lucide-layout-grid' : 'i-lucide-list'" size="sm" color="neutral" variant="ghost" @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'" />
          </UTooltip>
          <UButton icon="i-lucide-x" size="sm" color="neutral" variant="ghost" @click="emit('close')" />
        </div>
      </div>
    </template>
    <template #body>
      <div v-if="trashLoading" class="flex justify-center py-10">
        <UIcon name="i-lucide-loader-circle" class="text-2xl animate-spin text-gray-400" />
      </div>
      <div v-else-if="trashItems.length === 0" class="text-center text-gray-400 py-10 text-sm">
        {{ $t('app.trashEmpty') }}
      </div>
      <div v-else-if="viewMode === 'grid'" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-96 overflow-auto p-1">
        <div v-for="t in trashItems" :key="t.id" class="aspect-square rounded-lg bg-gray-50 dark:bg-gray-900 border flex flex-col items-center justify-center p-2 relative group">
          <UIcon :name="t.isFolder ? 'i-lucide-folder' : 'i-lucide-file'" class="text-2xl text-gray-400" />
          <span class="text-xs mt-1 truncate w-full text-center">{{ t.name }}</span>
          <div class="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <UButton icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" :title="$t('app.restore')" loading-auto @click="restoreItem(t)" />
            <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" :title="$t('app.deleteForever')" loading-auto @click="deleteForever(t.id)" />
          </div>
          <UBadge size="xs" color="warning" class="absolute bottom-1 left-1">{{ $t('app.remainingDays', { days: t.expiresDays }) }}</UBadge>
        </div>
      </div>
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-auto">
        <div v-for="t in trashItems" :key="t.id" class="py-3 flex items-start gap-3">
          <UIcon :name="t.isFolder ? 'i-lucide-folder' : 'i-lucide-file'" class="text-lg shrink-0 mt-0.5 text-gray-400" />
          <div class="flex-1 min-w-0">
            <p class="text-sm truncate font-medium flex items-center gap-1">
              {{ t.name }}
              <UTooltip :text="t.originalPath">
                <UIcon name="i-lucide-folder" class="text-gray-400 shrink-0" />
              </UTooltip>
            </p>
            <div class="flex gap-3 text-xs text-gray-400 mt-0.5">
              <span>{{ formatSize(t.size) }}</span>
              <span>{{ $t('app.deletedAt') }}: {{ formatTime(t.deletedAt) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UBadge size="md" color="warning">{{ $t('app.remainingDays', { days: t.expiresDays }) }}</UBadge>
            <UButton icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" :title="$t('app.restore')" loading-auto @click="restoreItem(t)" />
            <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" :title="$t('app.deleteForever')" loading-auto @click="deleteForever(t.id)" />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
