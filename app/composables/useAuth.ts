import { authClient } from '~/lib/auth-client'

export function useAuth() {
  const session = ref<any>(null)
  const isAuthenticated = computed(() => !!session.value?.user)
  // 存储占用（真实数据来自 /api/storage/usage，初始为占位值：上限默认 1TB）
  const storage = ref({ used: 0, limit: 1024 * 1024 * 1024 * 1024 })

  // 用 getSession() 替代 useSession(useFetch) 避免 Suspense 挂起
  authClient.getSession().then(({ data }) => {
    session.value = data
  })

  /** 从服务端刷新存储占用与配额（limit=0 表示无限制） */
  async function refreshStorage() {
    try {
      const res = await $fetch<{ used: number, limit: number }>('/api/storage/usage')
      storage.value = {
        used: Number(res.used) || 0,
        limit: typeof res.limit === 'number' && Number.isFinite(res.limit) && res.limit >= 0 ? res.limit : storage.value.limit
      }
    } catch {
      // 拉取失败时保留旧值
    }
  }
  refreshStorage()

  const user = computed(() => {
    const u = session.value?.user
    if (!u) return null
    return {
      id: u.id,
      email: u.email,
      storageUsed: storage.value.used,
      storageLimit: storage.value.limit,
      createdAt: new Date((u as any).createdAt).getTime()
    }
  })

  async function login(email: string) {
    await $fetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      body: { email, type: 'sign-in' }
    })
  }

  /** 用户名密码登录（用户名可为邮箱或昵称） */
  async function passwordLogin(username: string, password: string) {
    await $fetch('/api/auth/sign-in/password', {
      method: 'POST',
      body: { username, password },
      credentials: 'include'
    }).catch((e) => {
      throw new Error(e?.data?.message || '登录失败')
    })
    const { data } = await authClient.getSession()
    session.value = data
  }

  async function verify(email: string, otp: string) {
    await $fetch('/api/auth/sign-in/email-otp', {
      method: 'POST',
      body: { email, otp },
      credentials: 'include'
    }).catch((e) => {
      throw new Error(e?.data?.message || '验证失败')
    })
    const { data } = await authClient.getSession()
    session.value = data
  }

  /** 当前用户是否已设置密码 */
  async function hasPassword(): Promise<boolean> {
    try {
      const res = await $fetch<{ hasPassword: boolean }>('/api/auth/has-password')
      return !!res.hasPassword
    } catch {
      return true // 查询失败时保守处理，不强制设置密码
    }
  }

  /** 设置初始密码（仅限尚未设置密码的用户） */
  async function setPassword(password: string) {
    await $fetch('/api/auth/set-password', {
      method: 'POST',
      body: { password }
    }).catch((e) => {
      throw new Error(e?.data?.message || '设置密码失败')
    })
  }

  /** 修改密码（需验证旧密码） */
  async function changePassword(currentPassword: string, newPassword: string) {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    }).catch((e) => {
      throw new Error(e?.data?.message || '修改密码失败')
    })
  }

  async function logout() {
    await authClient.signOut()
    await navigateTo('/login')
  }

  return { user, isAuthenticated, login, passwordLogin, verify, logout, refreshStorage, hasPassword, setPassword, changePassword }
}
