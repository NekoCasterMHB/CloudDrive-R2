/**
 * 统一获取 Cloudflare bindings（D1 / R2 / EMAIL ...）
 *
 * 本地开发（pnpm dev）：
 *   Nitro 的 cloudflare dev 插件通过 `wrangler.getPlatformProxy()` 启动本地 Miniflare，
 *   按根目录 `wrangler.toml` 注入绑定到 `globalThis.__env__`
 *   （D1/R2 本地持久化在 `.wrangler/state/v3`，不会访问云端资源）
 *
 * 部署后：
 *   worker 的 fetchHandler 把真实 env 注入 `globalThis.__env__`
 *
 * 这样数据库（D1 binding）与对象存储（R2 binding）在开发/生产走完全相同的代码路径。
 */

type R2MultipartUploadLike = {
  key: string
  uploadId: string
  uploadPart(partNumber: number, value: any): Promise<{ etag: string, partNumber: number }>
  complete(uploadedParts: { partNumber: number, etag: string }[]): Promise<any>
  abort(): Promise<void>
}

interface R2BucketLike {
  put(key: string, value: any, options?: any): Promise<any>
  get(key: string): Promise<any>
  delete(key: string): Promise<void>
  createMultipartUpload(key: string, options?: any): Promise<R2MultipartUploadLike>
  resumeMultipartUpload?(key: string, uploadId: string): R2MultipartUploadLike
}

export interface CloudflareBindings {
  DB: any
  R2: R2BucketLike
  EMAIL?: any
  [key: string]: any
}

export function getBindings(): CloudflareBindings {
  const env = tryGetBindings()
  if (!env) {
    throw new Error('[bindings] Cloudflare bindings 不可用。请通过 `pnpm dev`（wrangler 本地绑定模拟）或部署到 Cloudflare Workers 运行。')
  }
  return env
}

/** 非抛出版：无绑定环境时返回 undefined */
export function tryGetBindings(): CloudflareBindings | undefined {
  return ((globalThis as any).__env__ || (globalThis as any).__cfEnv) as CloudflareBindings | undefined
}

/** 获取 D1 数据库绑定（env.DB） */
export function getDB(): any {
  const env = getBindings()
  if (!env.DB) {
    throw new Error('[bindings] D1 binding `DB` 不可用，请确认 wrangler.toml 已配置 d1_databases')
  }
  return env.DB
}

/** 获取 R2 存储桶绑定（env.R2） */
export function getR2(): R2BucketLike {
  const env = getBindings()
  if (!env.R2) {
    throw new Error('[bindings] R2 binding `R2` 不可用，请确认 wrangler.toml 已配置 r2_buckets')
  }
  return env.R2
}
