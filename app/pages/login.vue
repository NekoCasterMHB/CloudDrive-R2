<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <UIcon
            name="i-lucide-cloud"
            class="text-4xl text-primary mb-2 mx-auto"
          />
          <h1 class="text-2xl font-bold">
            {{ $t('app.name') }}
          </h1>
          <p class="text-sm text-gray-500 mt-1">
            {{ $t('app.login') }}
          </p>
        </div>
      </template>

      <!-- 登录方式切换 -->
      <UTabs
        v-model="loginMode"
        color="neutral"
        variant="link"
        :content="false"
        :items="loginTabs"
        class="w-full mb-4"
      />

      <!-- 密码登录 -->
      <form
        v-if="loginMode === 'password'"
        class="space-y-4"
        @submit.prevent="handlePasswordLogin"
      >
        <UFormField :label="$t('app.username')">
          <UInput
            v-model="pwdUsername"
            :placeholder="$t('app.usernamePlaceholder')"
            icon="i-lucide-user"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('app.password')">
          <UInput
            v-model="pwdPassword"
            type="password"
            :placeholder="$t('app.passwordPlaceholder')"
            icon="i-lucide-lock"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          block
          size="lg"
          :loading="loading"
        >
          {{ $t('app.login') }}
        </UButton>
      </form>

      <template v-else>
        <form
          v-if="!codeSent"
          class="space-y-4"
          @submit.prevent="handleLogin"
        >
          <UFormField :label="$t('app.emailLabel')">
            <UInputMenu
              v-model="email"
              mode="autocomplete"
              :items="emailSuggestions"
              :placeholder="$t('app.emailPlaceholder')"
              :content="{ hideWhenEmpty: true }"
              :trailing-icon="false"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="loading"
          >
            {{ $t('app.sendCode') }}
          </UButton>
        </form>

        <form
          v-else-if="!showPasswordStep"
          class="space-y-4"
          @submit.prevent="handleVerify"
        >
          <UFormField :label="$t('app.codeLabel', { email })">
            <UInput
              v-model="code"
              :placeholder="$t('app.codePlaceholder')"
              maxlength="6"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="loading"
          >
            {{ $t('app.verifyCode') }}
          </UButton>
          <UButton
            variant="ghost"
            block
            @click="codeSent = false"
          >
            {{ $t('app.changeEmail') }}
          </UButton>
        </form>

        <!-- 设置密码步骤：验证码正确且首次登录（尚无密码）时显示 -->
        <form
          v-else
          class="space-y-4"
          @submit.prevent="handleSetPassword"
        >
          <UFormField :label="$t('app.setPasswordHint', { email })">
            <UInput
              v-model="password"
              type="password"
              :placeholder="$t('app.passwordPlaceholder')"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="$t('app.confirmPassword')">
            <UInput
              v-model="confirmPassword"
              type="password"
              :placeholder="$t('app.confirmPasswordPlaceholder')"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="loading"
          >
            {{ $t('app.setPassword') }}
          </UButton>
          <UButton
            variant="ghost"
            block
            @click="skipPassword"
          >
            {{ $t('app.skipForNow') }}
          </UButton>
        </form>
      </template>

      <UAlert
        v-if="error"
        :title="error.startsWith('app.') ? $t(error) : error"
        color="error"
        variant="soft"
        class="mt-3"
        @close="error = ''"
      />

      <!-- 语言切换 -->
      <div class="mt-4 flex justify-center gap-2">
        <UButton
          v-for="loc in locales"
          :key="loc.code"
          :variant="loc.code === locale ? 'solid' : 'ghost'"
          size="xs"
          @click="switchLocale(loc.code)"
        >
          {{ loc.name }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

definePageMeta({ layout: false })

const { login, verify, hasPassword, setPassword, passwordLogin } = useAuth()
const { locale, locales, setLocale, t } = useI18n()
type LocaleCode = 'zh-CN' | 'ja' | 'en'
const { suggest: suggestEmails, add: addEmail } = useEmailHistory()

const email = ref('')
const code = ref('')
const codeSent = ref(false)
const showPasswordStep = ref(false)
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const emailSuggestions = computed(() => suggestEmails(email.value))

// 密码登录
const loginMode = ref<'otp' | 'password'>('otp')
const loginTabs = computed<TabsItem[]>(() => [
  { label: t('app.loginWithCode'), value: 'otp' },
  { label: t('app.loginWithPassword'), value: 'password' }
])
const pwdUsername = ref('')
const pwdPassword = ref('')

async function handlePasswordLogin() {
  loading.value = true
  error.value = ''
  try {
    await passwordLogin(pwdUsername.value, pwdPassword.value)
    await navigateTo('/')
  } catch (e: any) {
    console.error('[PasswordLogin]', e)
    error.value = e?.message || 'app.loginFailed'
  } finally {
    loading.value = false
  }
}

function switchLocale(code: string) {
  setLocale(code as LocaleCode)
}

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await login(email.value)
    addEmail(email.value)
    codeSent.value = true
  } catch (e: any) {
    console.error('[Login]', e)
    error.value = e?.data?.code === 'REGISTER_DISABLED' ? 'app.registerDisabled' : (e?.data?.message || e?.message || 'app.sendFailed')
  } finally {
    loading.value = false
  }
}

async function handleVerify() {
  loading.value = true
  error.value = ''
  try {
    await verify(email.value, code.value)
    // 验证码正确：若尚无密码则进入设置密码步骤，否则直接进入
    const has = await hasPassword()
    if (has) {
      await navigateTo('/')
    } else {
      showPasswordStep.value = true
    }
  } catch (e: any) {
    console.error('[Verify]', e)
    error.value = e?.data?.code === 'REGISTER_DISABLED' ? 'app.registerDisabled' : (e?.data?.message || e?.message || 'app.codeError')
  } finally {
    loading.value = false
  }
}

async function handleSetPassword() {
  error.value = ''
  if (password.value.length < 6) {
    error.value = 'app.passwordTooShort'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'app.passwordMismatch'
    return
  }
  loading.value = true
  try {
    await setPassword(password.value)
    await navigateTo('/')
  } catch (e: any) {
    console.error('[SetPassword]', e)
    error.value = e?.message || 'app.setPasswordFailed'
  } finally {
    loading.value = false
  }
}

function skipPassword() {
  navigateTo('/')
}
</script>
