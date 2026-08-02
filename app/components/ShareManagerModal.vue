<script setup lang="ts">
import { LazyConfirmModal } from '#components'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ close: [] }>()

interface ShareRecord {
  token: string
  items: { id: string, type: string, name: string }[]
  hasPassword: boolean
  expiresAt: number | null
  createdAt: number
  expired: boolean
}

const loading = ref(false)
const error = ref('')
const shares = ref<ShareRecord[]>([])
const removing = ref<string | null>(null)

function formatDate(v: number | null): string {
  if (!v) return t('app.sharePermanent')
  const d = new Date(v)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ shares: ShareRecord[] }>('/api/shares')
    shares.value = res.shares || []
  } catch (e: any) {
    error.value = e?.data?.message || t('app.shareListFailed')
  } finally {
    loading.value = false
  }
}

async function copyLink(s: ShareRecord) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${s.token}`)
    toast.add({ title: t('app.shareCopied'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch {
    // 忽略
  }
}

async function removeShare(s: ShareRecord) {
  removing.value = s.token
  try {
    await $fetch(`/api/shares/${s.token}`, { method: 'DELETE' })
    shares.value = shares.value.filter(x => x.token !== s.token)
    toast.add({ title: t('app.shareRemoved'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t('app.shareRemoveFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    removing.value = null
  }
}

function confirmRemove(s: ShareRecord) {
  const overlay = useOverlay()
  overlay.create(LazyConfirmModal).open({
    title: t('app.shareRemove'),
    message: t('app.shareRemoveConfirm'),
    icon: 'i-lucide-share-2',
    onConfirm: () => removeShare(s)
  })
}

onMounted(load)
</script>

<template>
  <UModal
    :title="t('app.shareManager')"
  >
    <template #body>
      <div class="space-y-3">
        <p
          v-if="error"
          class="text-sm text-red-500"
        >
          {{ error }}
        </p>

        <div
          v-if="loading"
          class="flex justify-center py-8"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="text-2xl text-gray-400 animate-spin"
          />
        </div>

        <div
          v-else-if="shares.length === 0"
          class="py-8 text-center text-sm text-gray-400"
        >
          {{ t('app.shareEmpty') }}
        </div>

        <div
          v-for="s in shares"
          :key="s.token"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium truncate">{{ s.items.length }} {{ t('app.shareItemsShort') }}</span>
                <UBadge
                  v-if="s.hasPassword"
                  color="warning"
                  size="xs"
                  :label="t('app.shareBadgePassword')"
                />
                <UBadge
                  v-if="s.expired"
                  color="error"
                  size="xs"
                  :label="t('app.shareBadgeExpired')"
                />
              </div>
              <p class="text-xs text-gray-400 mt-1 truncate">
                {{ s.items.map(i => i.name).join('、') }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ t('app.shareExpiresAt') }} {{ formatDate(s.expiresAt) }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                icon="i-lucide-copy"
                size="sm"
                variant="outline"
                :title="t('app.copy')"
                @click="copyLink(s)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                variant="outline"
                color="error"
                :loading="removing === s.token"
                :title="t('app.shareRemove')"
                @click="confirmRemove(s)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          variant="ghost"
          @click="emit('close')"
        >
          {{ t('app.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
