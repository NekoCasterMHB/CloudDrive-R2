<script setup lang="ts">
import { LazyConfirmModal } from '#components'

const { t } = useI18n()
const toast = useToast()

interface AdminUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  groupId: string | null
  createdAt: number
}
interface AdminGroup {
  id: string
  name: string
  storageLimit: number // 0 = 无限制
  canChangePassword: boolean
  uploadChunkSize: number
  userCount: number
}

const loading = ref(true)
const error = ref('')
const users = ref<AdminUser[]>([])
const groups = ref<AdminGroup[]>([])
const savingId = ref<string | null>(null)

// 是否允许新用户注册（全局开关，默认关闭）
const allowRegister = ref(false)
const savingRegister = ref(false)

async function loadRegister() {
  try {
    const res = await $fetch<{ allowRegister: boolean }>('/api/admin/register-setting')
    allowRegister.value = res.allowRegister
  } catch {
    // 保持默认
  }
}

async function toggleRegister(v: boolean) {
  savingRegister.value = true
  try {
    const res = await $fetch<{ allowRegister: boolean }>('/api/admin/register-setting', { method: 'PUT', body: { allowRegister: v } })
    allowRegister.value = res.allowRegister
    toast.add({ title: t('app.saved'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t('app.saveFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    savingRegister.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ users: AdminUser[], groups: AdminGroup[] }>('/api/admin/users')
    users.value = res.users || []
    groups.value = res.groups || []
  } catch (e: any) {
    error.value = e?.data?.message || t('app.loadFailed')
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  load()
  loadRegister()
})

function groupName(id: string | null): string {
  if (!id) return t('app.noGroup')
  return groups.value.find(g => g.id === id)?.name || t('app.noGroup')
}

async function setRole(u: AdminUser) {
  savingId.value = u.id
  try {
    const next = u.role === 'admin' ? 'user' : 'admin'
    await $fetch(`/api/admin/users/${u.id}/role`, { method: 'POST', body: { role: next } })
    u.role = next
    toast.add({ title: t('app.saved'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t('app.saveFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    savingId.value = null
  }
}

async function assignGroup(u: AdminUser, groupId: string) {
  savingId.value = u.id
  try {
    // 'none' 表示未分组（Reka UI ComboboxItem 禁止空字符串 value）
    const gid = groupId === 'none' ? null : groupId
    await $fetch(`/api/admin/users/${u.id}/group`, { method: 'POST', body: { groupId: gid } })
    u.groupId = gid
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t('app.saveFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    savingId.value = null
  }
}

// ===== 用户组新建/编辑 =====
const showGroupModal = ref(false)
const editingGroup = ref<AdminGroup | null>(null)
const STORAGE_UNIT_BYTES = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 } as const
type StorageLimitUnit = 'MB' | 'GB' | 'TB'
const storageLimitUnitOptions = [
  { label: 'MB', value: 'MB' },
  { label: 'GB', value: 'GB' },
  { label: 'TB', value: 'TB' }
]
const groupForm = reactive({
  name: '',
  storageLimitValue: 1,
  storageLimitUnit: 'GB' as StorageLimitUnit,
  unlimited: true,
  canChangePassword: true,
  uploadChunkSize: 10 * 1024 * 1024
})
const savingGroup = ref(false)

const chunkOptions = [
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '20 MB', value: 20 * 1024 * 1024 },
  { label: '50 MB', value: 50 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 }
]

function openCreateGroup() {
  editingGroup.value = null
  groupForm.name = ''
  groupForm.storageLimitValue = 1
  groupForm.storageLimitUnit = 'GB'
  groupForm.unlimited = true
  groupForm.canChangePassword = true
  groupForm.uploadChunkSize = 10 * 1024 * 1024
  showGroupModal.value = true
}
function openEditGroup(g: AdminGroup) {
  editingGroup.value = g
  groupForm.name = g.name
  groupForm.unlimited = g.storageLimit === 0
  if (g.storageLimit > 0) {
    // 自动选择最合适的单位（同设置页逻辑）
    const units: StorageLimitUnit[] = ['MB', 'GB', 'TB']
    let chosen: StorageLimitUnit = 'GB'
    let val = g.storageLimit / STORAGE_UNIT_BYTES.GB
    for (const unit of units) {
      const v = g.storageLimit / STORAGE_UNIT_BYTES[unit]
      if (v >= 1 && v < 1024) {
        chosen = unit
        val = v
        break
      }
    }
    groupForm.storageLimitUnit = chosen
    groupForm.storageLimitValue = Math.round(val * 100) / 100
  } else {
    groupForm.storageLimitValue = 1
    groupForm.storageLimitUnit = 'GB'
  }
  groupForm.canChangePassword = g.canChangePassword
  groupForm.uploadChunkSize = g.uploadChunkSize > 0 ? g.uploadChunkSize : 10 * 1024 * 1024
  showGroupModal.value = true
}

async function saveGroup() {
  if (!groupForm.name.trim()) {
    toast.add({ title: t('app.groupNameRequired'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
    return
  }
  savingGroup.value = true
  try {
    const payload = {
      name: groupForm.name.trim(),
      storageLimit: groupForm.unlimited ? 0 : Math.round((Number(groupForm.storageLimitValue) || 0) * STORAGE_UNIT_BYTES[groupForm.storageLimitUnit]),
      canChangePassword: groupForm.canChangePassword,
      uploadChunkSize: groupForm.uploadChunkSize
    }
    if (editingGroup.value) {
      await $fetch(`/api/admin/groups/${editingGroup.value.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/admin/groups', { method: 'POST', body: payload })
    }
    showGroupModal.value = false
    await load()
    toast.add({ title: t('app.saved'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch (e: any) {
    toast.add({ title: e?.data?.message || t('app.saveFailed'), icon: 'i-lucide-alert-triangle', color: 'error', duration: 2500 })
  } finally {
    savingGroup.value = false
  }
}

function confirmDeleteGroup(g: AdminGroup) {
  const overlay = useOverlay()
  overlay.create(LazyConfirmModal).open({
    title: t('app.deleteGroup'),
    message: t('app.deleteGroupConfirm'),
    icon: 'i-lucide-trash-2',
    onConfirm: async () => {
      await $fetch(`/api/admin/groups/${g.id}`, { method: 'DELETE' })
      await load()
    }
  })
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${u[i]}`
}
</script>

<template>
  <div class="space-y-6">
    <p
      v-if="error"
      class="text-sm text-red-500"
    >
      {{ error }}
    </p>

    <!-- 用户列表 -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between w-full">
          <h2 class="font-semibold">
            {{ $t('app.userList') }}
          </h2>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">{{ $t('app.allowRegister') }}</span>
            <USwitch
              :model-value="allowRegister"
              :loading="savingRegister"
              @update:model-value="(v: boolean) => toggleRegister(v)"
            />
          </div>
        </div>
      </template>
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
        v-else
        class="divide-y divide-gray-100 dark:divide-gray-800"
      >
        <div
          v-for="u in users"
          :key="u.id"
          class="py-3 flex flex-wrap items-center gap-3"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium truncate">{{ u.name || u.email }}</span>
              <UBadge
                :color="u.role === 'admin' ? 'primary' : 'neutral'"
                size="sm"
                variant="subtle"
                :label="u.role === 'admin' ? t('app.admin') : t('app.normalUser')"
              />
            </div>
            <p class="text-xs text-gray-400 truncate">
              {{ u.email }}
            </p>
          </div>
          <USelectMenu
            :model-value="u.groupId || 'none'"
            :items="[{ label: t('app.noGroup'), value: 'none' }, ...groups.map(g => ({ label: g.name, value: g.id }))]"
            value-key="value"
            :search-input="false"
            class="w-40 shrink-0"
            :disabled="savingId === u.id"
            @update:model-value="(v: string) => assignGroup(u, v)"
          />
          <UButton
            :color="u.role === 'admin' ? 'warning' : 'primary'"
            :variant="u.role === 'admin' ? 'outline' : 'subtle'"
            size="sm"
            :icon="u.role === 'admin' ? 'i-lucide-shield-off' : 'i-lucide-shield'"
            :loading="savingId === u.id"
            class="shrink-0"
            @click="setRole(u)"
          >
            {{ u.role === 'admin' ? t('app.revokeAdmin') : t('app.grantAdmin') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- 用户组配置 -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between w-full">
          <h2 class="font-semibold">
            {{ $t('app.userGroups') }}
          </h2>
          <UButton
            icon="i-lucide-plus"
            color="primary"
            size="sm"
            @click="openCreateGroup"
          >
            {{ $t('app.createGroup') }}
          </UButton>
        </div>
      </template>
      <div
        v-if="groups.length === 0"
        class="py-6 text-center text-sm text-gray-400"
      >
        {{ $t('app.groupEmpty') }}
      </div>
      <div
        v-else
        class="space-y-3"
      >
        <div
          v-for="g in groups"
          :key="g.id"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ g.name }}</span>
                <span class="text-xs text-gray-400">{{ $t('app.memberCount', { count: g.userCount }) }}</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                {{ $t('app.storageLimit') }}: {{ g.storageLimit <= 0 ? $t('app.cacheSizeUnlimited') : formatSize(g.storageLimit) }}
                · {{ $t('app.canChangePassword') }}: {{ g.canChangePassword ? $t('app.yes') : $t('app.no') }}
                · {{ $t('app.chunkSize') }}: {{ formatSize(g.uploadChunkSize) }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                icon="i-lucide-square-pen"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="t('app.edit')"
                @click="openEditGroup(g)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                :aria-label="t('app.deleteGroup')"
                @click="confirmDeleteGroup(g)"
              />
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 新建/编辑用户组 -->
    <UModal
      v-model:open="showGroupModal"
      :title="editingGroup ? t('app.editGroup') : t('app.createGroup')"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('app.groupName')">
            <UInput
              v-model="groupForm.name"
              :placeholder="t('app.groupNamePlaceholder')"
            />
          </UFormField>

          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium">
                {{ $t('app.storageLimit') }}
              </p>
              <p class="text-xs text-gray-400">
                {{ $t('app.groupStorageHint') }}
              </p>
            </div>
            <div class="space-y-3">
              <div class="flex items-end gap-2">
                <UInput
                  v-model.number="groupForm.storageLimitValue"
                  type="number"
                  min="0.1"
                  step="0.1"
                  class="w-28"
                  :disabled="groupForm.unlimited"
                  :ui="{ base: groupForm.unlimited ? 'opacity-40 pointer-events-none' : '' }"
                />
                <USelectMenu
                  v-model="groupForm.storageLimitUnit"
                  :items="storageLimitUnitOptions"
                  value-key="value"
                  :search-input="false"
                  :disabled="groupForm.unlimited"
                  class="shrink-0"
                />
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-gray-500">{{ $t('app.cacheSizeUnlimited') }}</span>
                <USwitch v-model="groupForm.unlimited" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">
              {{ $t('app.canChangePassword') }}
            </p>
            <USwitch v-model="groupForm.canChangePassword" />
          </div>

          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium">
              {{ $t('app.chunkSize') }}
            </p>
            <USelect
              v-model="groupForm.uploadChunkSize"
              :items="chunkOptions"
              class="w-32"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          @click="showGroupModal = false"
        >
          {{ $t('app.cancel') }}
        </UButton>
        <UButton
          icon="i-lucide-check"
          color="primary"
          :loading="savingGroup"
          @click="saveGroup"
        >
          {{ $t('app.save') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>
