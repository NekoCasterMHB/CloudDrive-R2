// 从请求会话中获取当前登录用户 ID（未登录返回 null）
import { auth } from './auth'

export async function getUserId(event: any): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: new Headers(getRequestHeaders(event)) })
    return session?.user?.id || null
  } catch {
    return null
  }
}

/** 测试用户（存储上限固定 100MB，不可修改） */
export const TEST_USER_ID = 'test-user'
export const TEST_USER_LIMIT = 100 * 1024 * 1024 // 100MB

/** 获取用户 ID，未登录抛 401 */
export async function requireUserId(event: any): Promise<string> {
  const userId = await getUserId(event)
  if (!userId) throw createError({ statusCode: 401, message: '未登录' })
  return userId
}
