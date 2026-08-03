// GET /api/admin/register-setting — 获取是否允许新用户注册（需管理员）
import { getSystemSetting } from '../../utils/system-settings'
import { requireAdmin } from '../../utils/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const allowRegister = await getSystemSetting<boolean>('allow_register')
  return { allowRegister }
})
