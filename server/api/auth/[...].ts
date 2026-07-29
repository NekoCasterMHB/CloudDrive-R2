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

export default defineEventHandler(async (event) => {
  // 补全完整 URL（Nitro toWebRequest 可能缺少 origin）
  const url = new URL(event.path, getRequestURL(event).origin)
  const request = new Request(url, {
    method: event.method,
    headers: getRequestHeaders(event) as HeadersInit,
    body: event.method !== 'GET' && event.method !== 'HEAD' ? await readRawBody(event) : undefined,
  })
  return auth.handler(request)
})
