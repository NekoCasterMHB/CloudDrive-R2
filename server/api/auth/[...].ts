/**
 * Better Auth API 路由 — 挂载到 /api/auth/*
 *
 * Better Auth 自动处理：
 *   POST /api/auth/email-otp/send-verification-otp  — 发送验证码
 *   POST /api/auth/email-otp/verify-otp             — 验证 OTP + 登录
 *   GET  /api/auth/get-session                       — 获取当前会话
 *   POST /api/auth/sign-out                          — 登出
 */
import { auth } from '../../utils/auth'
import { getSystemSetting } from '../../utils/system-settings'
import { db } from '../../database'
import { user } from '../../db/auth-schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 补全完整 URL（Nitro toWebRequest 可能缺少 origin）
  const url = new URL(event.path, getRequestURL(event).origin)
  const rawBody = event.method !== 'GET' && event.method !== 'HEAD' ? await readRawBody(event) : undefined

  // 允许新用户注册开关（默认关闭）：在「发送验证码」阶段就拦截，避免白发验证码
  if (event.method === 'POST') {
    let isRegister = url.pathname.includes('sign-up')
    if (!isRegister && rawBody) {
      try {
        const body = JSON.parse(rawBody)
        // 显式注册类型（OTP type=sign-up）
        if (body?.type === 'sign-up') isRegister = true
        // OTP 登录发送验证码：若该邮箱用户不存在（将触发自动注册）且注册开关关闭，则直接拒绝、不发验证码
        if (!isRegister && body?.email && url.pathname.includes('/email-otp/send-verification-otp')) {
          const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, body.email)).limit(1)
          if (!existing) isRegister = true
        }
      } catch {
        // 非 JSON body，忽略
      }
    }
    if (isRegister) {
      const allowRegister = await getSystemSetting<boolean>('allow_register')
      if (!allowRegister) {
        setResponseStatus(event, 403)
        return { error: true, code: 'REGISTER_DISABLED', message: '管理员已关闭新用户注册功能' }
      }
    }
  }

  const request = new Request(url, {
    method: event.method,
    headers: getRequestHeaders(event) as HeadersInit,
    body: rawBody ?? undefined
  })
  return auth.handler(request)
})
