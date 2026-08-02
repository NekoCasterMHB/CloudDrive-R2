/**
 * Cloudflare Email Service 邮件发送
 *
 * 部署后：send_email binding (env.EMAIL.send)
 * 本地开发：Cloudflare REST API → real email
 * devConsoleEmail=true：打印到终端（不实际发送）
 */
import { tryGetBindings } from './bindings'

const HTML_TEMPLATE = (otp: string) => `
<div style="font-family:sans-serif;max-width:400px;margin:0 auto">
  <h2>CloudDrive 登录验证码</h2>
  <p style="font-size:32px;letter-spacing:8px;text-align:center;background:#f3f4f6;padding:16px;border-radius:8px">
    <strong>${otp}</strong>
  </p>
  <p style="color:#6b7280">5分钟内有效，请勿泄露给他人。</p>
</div>`

export async function sendOTPEmail(to: string, otp: string) {
  const config = useRuntimeConfig()

  // 生产环境：Cloudflare Workers Email binding（send_email）
  const cfEnv = tryGetBindings()
  if (cfEnv?.EMAIL) {
    await cfEnv.EMAIL.send({
      to,
      from: `${config.email.fromName} <${config.email.from}>`,
      subject: `CloudDrive 登录验证码: ${otp}`,
      html: HTML_TEMPLATE(otp),
      text: `您的 CloudDrive 登录验证码是: ${otp}。5分钟内有效。`
    })
    return
  }

  // 调试模式：只打印到终端
  if (config.devConsoleEmail === 'true') {
    printOTP(to, otp)
    return
  }

  // 本地开发：Cloudflare REST API 真实发送
  if (config.cfApiTokenEmail && config.cfAccountId) {
    try {
      const res = await $fetch<{
        success: boolean
        errors?: { code: number, message: string }[]
        result?: { delivered?: string[], permanent_bounces?: string[] }
      }>(
        `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/email/sending/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.cfApiTokenEmail}`,
            'Content-Type': 'application/json'
          },
          body: {
            to, // 纯邮箱字符串
            from: config.email.from, // 纯邮箱字符串
            subject: `CloudDrive 登录验证码: ${otp}`,
            html: HTML_TEMPLATE(otp),
            text: `您的 CloudDrive 登录验证码是: ${otp}。5分钟内有效。`
          }
        }
      )

      if (!res.success) {
        const errMsg = res.errors?.map(e => e.message).join(', ') || '未知错误'
        throw new Error(`API 返回失败: ${errMsg}`)
      }

      // 检查是否有永久退信
      if (res.result?.permanent_bounces?.length) {
        throw new Error(`投递失败（永久退信）: ${res.result.permanent_bounces.join(', ')}`)
      }

      console.log(`[Email] ✅ 验证码已发送至 ${to}`)
      return
    } catch (e: any) {
      console.warn(`[Email] 发送失败: ${e.message}`)
      console.warn('[Email] 请确认: 1) 域名已验证 2) Token 有 Email Sending:Edit 权限')
    }
  }

  // 兜底
  printOTP(to, otp)
}

function printOTP(to: string, otp: string) {
  console.log([
    '',
    '╔══════════════════════════════════════╗',
    `║  📧 验证码发送给: ${to.padEnd(20)} ║`,
    `║  🔑 验证码: ${otp.padEnd(22)} ║`,
    '╚══════════════════════════════════════╝',
    ''
  ].join('\n'))
}
