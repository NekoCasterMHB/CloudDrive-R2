import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { db } from '../database'
import * as authSchema from '../db/auth-schema'
import { sendOTPEmail } from './email'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3366',

  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: authSchema
  }),

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await sendOTPEmail(email, otp)
      }
    })
  ],

  // 邮箱 + 密码登录（提供 sign-in/email 等内置端点，供用户名密码登录复用）
  emailAndPassword: {
    enabled: true
  },

  emailVerification: {
    autoSignInAfterVerification: true
  }
})
