// DELETE /api/folders/:id
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // TODO: 删除 D1 记录 + 清理 R2 文件

  return { success: true }
})
