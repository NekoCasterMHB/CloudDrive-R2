// PUT /api/admin/register-setting — 设置是否允许新用户注册（需管理员）
import { readBody } from 'h3'
import { setSystemSetting } from '../../utils/system-settings'
import { requireAdmin } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ allowRegister?: boolean }>(event)
  const allowRegister = body?.allowRegister === true
  await setSystemSetting('allow_register', allowRegister)
  return { allowRegister }
})
