// 按文件名扩展名推断 MIME Content-Type
// 上传时浏览器 File.type 可能为空或被回退为 application/octet-stream，
// 导致图片/视频等媒体的 contentType 记录错误，进而影响预览缓存判断。
const EXT_TO_MIME: Record<string, string> = {
  // 图片
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
  avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', tiff: 'image/tiff', tif: 'image/tiff',
  // 视频
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm',
  // 音频
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', ogg: 'audio/ogg', m4a: 'audio/mp4',
  // 文档/其他
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json',
  csv: 'text/csv', xml: 'application/xml', html: 'text/html', zip: 'application/zip'
}

/** 根据文件名推断 MIME；无法识别时返回 fallback（默认 application/octet-stream） */
export function inferContentType(filename: string, fallback = 'application/octet-stream'): string {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || ''
  return EXT_TO_MIME[ext] || fallback
}
