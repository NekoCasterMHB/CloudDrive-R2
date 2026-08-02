/**
 * 管理已登录邮箱历史 — 存储在 localStorage
 */
export function useEmailHistory() {
  const KEY = 'clouddrive-emails'

  function getAll(): string[] {
    if (import.meta.server) return []
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]')
    } catch {
      return []
    }
  }

  /** 添加邮箱（去重，最新的放前面，最多保存 10 个） */
  function add(email: string) {
    const list = getAll().filter(e => e !== email)
    list.unshift(email)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)))
  }

  /** 匹配输入，返回建议 */
  function suggest(input: string): string[] {
    if (!input) return getAll().slice(0, 5)
    const lower = input.toLowerCase()
    return getAll().filter(e => e.toLowerCase().includes(lower)).slice(0, 5)
  }

  return { getAll, add, suggest }
}
