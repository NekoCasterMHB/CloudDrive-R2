import { authClient } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await authClient.getSession()
  if (!data?.user) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
