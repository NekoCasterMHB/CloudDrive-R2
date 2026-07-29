<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <UIcon name="i-lucide-cloud" class="text-4xl text-primary mb-2 mx-auto" />
          <h1 class="text-2xl font-bold">{{ $t('app.name') }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ $t('app.login') }}</p>
        </div>
      </template>

      <form v-if="!codeSent" @submit.prevent="handleLogin" class="space-y-4">
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
        <UButton type="submit" block size="lg" :loading="loading">
          {{ $t('app.sendCode') }}
        </UButton>
      </form>

      <form v-else @submit.prevent="handleVerify" class="space-y-4">
        <UFormField :label="$t('app.codeLabel', { email })">
          <UInput v-model="code" :placeholder="$t('app.codePlaceholder')" maxlength="6" size="lg" class="w-full" />
        </UFormField>
        <UButton type="submit" block size="lg" :loading="loading">
          {{ $t('app.verifyCode') }}
        </UButton>
        <UButton variant="ghost" block @click="codeSent = false">
          {{ $t('app.changeEmail') }}
        </UButton>
      </form>

      <UAlert v-if="error" :title="error" color="error" variant="soft" class="mt-3" @close="error = ''" />

      <!-- 语言切换 -->
      <div class="mt-4 flex justify-center gap-2">
        <UButton v-for="loc in locales" :key="loc.code" :variant="loc.code === locale ? 'solid' : 'ghost'" size="xs" @click="switchLocale(loc.code)">
          {{ loc.name }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { login, verify } = useAuth()
const { locale, locales, setLocale } = useI18n()
type LocaleCode = 'zh-CN' | 'ja' | 'en'
const { suggest: suggestEmails, add: addEmail } = useEmailHistory()

const email = ref('')
const code = ref('')
const codeSent = ref(false)
const loading = ref(false)
const error = ref('')
const emailSuggestions = computed(() => suggestEmails(email.value))

function switchLocale(code: string) {
  setLocale(code as LocaleCode)
}

async function handleLogin() {
  loading.value = true; error.value = ''
  try { await login(email.value); addEmail(email.value); codeSent.value = true }
  catch (e: any) {
    console.error('[Login]', e)
    error.value = e?.message || e?.data?.error || $t('app.sendFailed')
  }
  finally { loading.value = false }
}

async function handleVerify() {
  loading.value = true; error.value = ''
  try { await verify(email.value, code.value); await navigateTo('/') }
  catch (e: any) {
    console.error('[Verify]', e)
    error.value = e?.message || e?.data?.error || $t('app.codeError')
  }
  finally { loading.value = false }
}
</script>
