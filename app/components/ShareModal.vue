<script setup lang="ts">
import type { ShareItem } from '~~/types'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ close: [] }>()

const props = defineProps<{
  items: ShareItem[]
}>()

// 密码（6 位，字母 + 数字混合）
const usePassword = ref(false)
const password = ref('')
// 有效期：开关默认关闭 = 永久有效；开启后设定有效期（数值 + 单位，最大值 100）
const hasExpiry = ref(false)
const durationValue = ref<number>(24)
const durationUnit = ref<'hours' | 'days'>('hours')

/** 随机密码字符集（去除易混淆字符，如 0/O、1/l/I） */
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
/** 随机 6 位密码（字母 + 数字混合） */
function randomPassword(len = 6): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += PASSWORD_CHARS[(bytes[i] ?? 0) % PASSWORD_CHARS.length]
  }
  return out
}

// 开启密码保护时直接随机生成一个密码
watch(usePassword, (v) => {
  if (v && !password.value) password.value = randomPassword()
})

/** 预计过期时间（当前时间 + 设定的有效期） */
const estimatedExpiry = computed(() => {
  if (!hasExpiry.value) return ''
  const v = Math.min(100, Math.max(1, Math.floor(Number(durationValue.value) || 1)))
  const hours = durationUnit.value === 'days' ? v * 24 : v
  const d = new Date(Date.now() + hours * 3600 * 1000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})

const creating = ref(false)
const error = ref('')
const created = ref(false)
const shareUrl = ref('')
const copyDone = ref(false)
const pwdCopied = ref(false)

const title = computed(() => t('app.share'))

async function createShare() {
  error.value = ''
  creating.value = true
  copyDone.value = false
  try {
    // 有效期转小时（0 表示永久有效）
    let expiresHours = 0
    if (hasExpiry.value) {
      const v = Math.min(100, Math.max(1, Math.floor(Number(durationValue.value) || 1)))
      expiresHours = durationUnit.value === 'days' ? v * 24 : v
    }
    const res = await $fetch<{ token: string }>('/api/shares', {
      method: 'POST',
      body: {
        items: props.items.map(i => ({ id: i.id, type: i.type })),
        password: usePassword.value ? password.value : undefined,
        expiresHours
      }
    })
    shareUrl.value = `${window.location.origin}/s/${res.token}`
    created.value = true
  } catch (e: any) {
    console.error('[Share] create failed', e)
    error.value = e?.data?.message || e?.message || t('app.shareFailed')
  } finally {
    creating.value = false
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copyDone.value = true
    toast.add({ title: t('app.shareCopied'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch {
    // 剪贴板不可用时忽略
  }
}

async function copyPwd() {
  try {
    await navigator.clipboard.writeText(password.value)
    pwdCopied.value = true
    toast.add({ title: t('app.shareCopied'), icon: 'i-lucide-check', color: 'success', duration: 2000 })
  } catch {
    // 剪贴板不可用时忽略
  }
}
</script>

<template>
  <UModal :title="title">
    <template #body>
      <div class="space-y-4">
        <!-- 已选分享项 -->
        <div
          v-if="!created"
          class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
        >
          <p class="text-sm font-medium mb-2">
            {{ t('app.shareItems', { count: items.length }) }}
          </p>
          <div class="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="item in items"
              :key="`${item.type}-${item.id}`"
              class="flex items-center gap-2 py-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              <UIcon
                :name="item.type === 'folder' ? 'i-lucide-folder' : 'i-lucide-file'"
                class="shrink-0 text-gray-400 dark:text-gray-500"
              />
              <span class="truncate">{{ item.name }}</span>
            </div>
          </div>
        </div>

        <!-- 密码设置 -->
        <div
          v-if="!created"
          class="flex items-center justify-between gap-3"
        >
          <div class="flex-1">
            <p class="text-sm font-medium">
              {{ t('app.sharePassword') }}
            </p>
            <p class="text-xs text-gray-400">
              {{ t('app.sharePasswordHint') }}
            </p>
          </div>
          <USwitch v-model="usePassword" />
        </div>
        <UInput
          v-if="!created && usePassword"
          v-model="password"
          type="text"
          :placeholder="t('app.sharePasswordPlaceholder')"
          icon="i-lucide-lock"
          size="lg"
        >
          <template #trailing>
            <UButton
              icon="i-lucide-dices"
              variant="ghost"
              size="xs"
              :title="t('app.shareRandomPwd')"
              @click="password = randomPassword()"
            />
          </template>
        </UInput>

        <!-- 有效期 -->
        <div
          v-if="!created"
          class="flex items-center justify-between gap-3"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">
                {{ t('app.shareExpires') }}
              </p>
              <UBadge
                v-if="!hasExpiry"
                color="success"
                size="sm"
                variant="subtle"
                :label="t('app.sharePermanent')"
              />
            </div>
            <p class="text-xs text-gray-400">
              {{ t('app.shareExpiresHint') }}
            </p>
          </div>
          <USwitch v-model="hasExpiry" />
        </div>
        <div
          v-if="!created && hasExpiry"
          class="flex items-center gap-3"
        >
          <UFieldGroup class="flex-1">
            <UInput
              v-model.number="durationValue"
              type="number"
              min="1"
              max="100"
              class="flex-1"
            />
            <USelectMenu
              v-model="durationUnit"
              :items="[
                { label: t('app.shareUnitHours'), value: 'hours' },
                { label: t('app.shareUnitDays'), value: 'days' }
              ]"
              value-key="value"
              :search-input="false"
              class="w-28 shrink-0"
            />
          </UFieldGroup>
          <span class="text-xs text-gray-400 shrink-0">
            {{ t('app.shareEstimated') }} {{ estimatedExpiry }}
          </span>
        </div>

        <p
          v-if="error"
          class="text-sm text-red-500"
        >
          {{ error }}
        </p>

        <!-- 生成按钮 -->
        <UButton
          v-if="!created"
          color="primary"
          block
          :loading="creating"
          :disabled="usePassword && password.length < 6"
          @click="createShare"
        >
          {{ t('app.shareGenerate') }}
        </UButton>

        <!-- 生成结果 -->
        <div
          v-else
          class="space-y-3"
        >
          <p class="text-sm text-green-600 dark:text-green-400">
            {{ t('app.shareGenerated') }}
          </p>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400 shrink-0 w-8">
              {{ t('app.shareLink') }}
            </span>
            <UFieldGroup class="flex-1 min-w-0">
              <UInput
                :model-value="shareUrl"
                readonly
                class="flex-1"
                :ui="{ base: 'truncate px-3' }"
              />
              <UButton
                icon="i-lucide-copy"
                color="primary"
                variant="outline"
                :class="copyDone ? 'text-green-500' : ''"
                @click="copyUrl"
              >
                {{ copyDone ? t('app.copied') : t('app.copy') }}
              </UButton>
            </UFieldGroup>
          </div>
          <!-- 密码显示与复制 -->
          <div
            v-if="usePassword && password"
            class="flex items-center gap-2"
          >
            <span class="text-xs text-gray-400 shrink-0 w-8">
              {{ t('app.password') }}
            </span>
            <UFieldGroup class="flex-1 min-w-0">
              <UInput
                :model-value="password"
                readonly
                class="flex-1"
                :ui="{ base: 'truncate px-3' }"
              />
              <UButton
                icon="i-lucide-copy"
                color="primary"
                variant="outline"
                :class="pwdCopied ? 'text-green-500' : ''"
                @click="copyPwd"
              >
                {{ pwdCopied ? t('app.copied') : t('app.copy') }}
              </UButton>
            </UFieldGroup>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          @click="emit('close')"
        >
          {{ created ? t('app.close') : t('app.cancel') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
