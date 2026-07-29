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
    schema: authSchema,
  }),

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail(email, otp)
      },
    }),
  ],

  emailVerification: {
    autoSignInAfterVerification: true,
  },
})
