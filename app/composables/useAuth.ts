import { authClient } from '~/lib/auth-client'

export function useAuth() {
  const session = ref<any>(null)
  const isAuthenticated = computed(() => !!session.value?.user)

  // 用 getSession() 替代 useSession(useFetch) 避免 Suspense 挂起
  authClient.getSession().then(({ data }) => {
    session.value = data
  })

  const user = computed(() => {
    const u = session.value?.user
    if (!u) return null
    return {
      id: u.id,
      email: u.email,
      storageUsed: 0,
      storageLimit: 10 * 1024 * 1024 * 1024,
      createdAt: new Date((u as any).createdAt).getTime(),
    }
  })

  async function login(email: string) {
    await $fetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      body: { email, type: 'sign-in' },
    })
  }

  async function verify(email: string, otp: string) {
    await $fetch('/api/auth/sign-in/email-otp', {
      method: 'POST',
      body: { email, otp },
      credentials: 'include',
    }).catch((e) => {
      throw new Error(e?.data?.message || '验证失败')
    })
    const { data } = await authClient.getSession()
    session.value = data
  }

  async function logout() {
    await authClient.signOut()
    await navigateTo('/login')
  }

  return { user, isAuthenticated, login, verify, logout }
}
