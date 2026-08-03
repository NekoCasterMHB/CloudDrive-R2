import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { db } from '../database'
import * as authSchema from '../db/auth-schema'
import { sql } from 'drizzle-orm'
import { sendOTPEmail } from './email'
import { getSystemSetting } from './system-settings'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3366',

  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: authSchema
  }),

  user: {
    // 自定义用户字段：角色 + 用户组（input: false → 客户端无法写入，仅服务端管理）
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false
      },
      groupId: {
        type: 'string',
        required: false,
        input: false
      }
    }
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // 允许新用户注册开关（默认关闭）：关闭时拒绝新用户注册
          const allowRegister = await getSystemSetting<boolean>('allow_register')
          if (!allowRegister) {
            throw new Error('注册功能已关闭，请联系系统管理员')
          }
          // 系统内第一个注册用户默认管理员，后续默认普通用户
          const [row] = await db.select({ count: sql<number>`count(*)` }).from(authSchema.user)
          const role = (row?.count ?? 0) === 0 ? 'admin' : 'user'
          return { data: { ...user, role } }
        }
      }
    }
  },

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
