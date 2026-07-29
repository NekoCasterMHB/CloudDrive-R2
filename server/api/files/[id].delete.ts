// DELETE /api/files/:id
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // TODO: 删除 D1 记录 + 清理 R2 对象

  return { success: true }
})
