// POST /share-target — Web Share Target 兜底路由
// 正常流程由 sw-custom.js 在 Service Worker 层拦截（暂存文件 + 重定向），
// 仅当 SW 未激活（首次安装前/浏览器不支持）时请求才会落到这里，直接回首页。
export default defineEventHandler((event) => {
  return sendRedirect(event, '/', 303)
})
