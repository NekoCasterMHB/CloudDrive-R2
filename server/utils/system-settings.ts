// 全局系统设置读写（system_settings 表，key-value / value 为 JSON 字符串）
import { db } from '@nuxthub/db'
import { systemSettings } from '../database/schema'
import { eq } from 'drizzle-orm'

const DEFAULT_VALUES: Record<string, unknown> = {
  // 是否允许新用户注册（默认关闭）
  allow_register: false
}

export async function getSystemSetting<T = unknown>(key: string): Promise<T> {
  try {
    const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key))
    if (row) {
      return JSON.parse(row.value) as T
    }
  } catch {
    // 读取失败时使用默认值
  }
  return (DEFAULT_VALUES[key] ?? null) as T
}

export async function setSystemSetting(key: string, value: unknown) {
  await db
    .insert(systemSettings)
    .values({ key, value: JSON.stringify(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: JSON.stringify(value), updatedAt: new Date() }
    })
}
