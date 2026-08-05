// GET /api/storage/usage — 返回当前用户的存储占用与配额（配额来自用户组/个人设置，默认 1TB）
import { getStorageQuota } from '../../utils/quota'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return await getStorageQuota(userId)
})
