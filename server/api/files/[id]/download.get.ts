// GET /api/files/:id/download — 下载文件内容（供预览使用）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // TODO: 从 D1 查询 object_key → 生成 R2 Signed URL → 302 redirect
  // const signedUrl = await getR2SignedUrl(objectKey)
  // return sendRedirect(event, signedUrl)

  // 开发阶段：返回 501
  throw createError({ statusCode: 501, message: '待实现：R2 Signed URL' })
})
