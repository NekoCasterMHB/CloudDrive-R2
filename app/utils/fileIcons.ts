/** 文件扩展名 → Lucide 图标映射表 */
export const FILE_ICON_MAP: Record<string, string> = {
  // 图片
  'jpg': 'i-lucide-image', 'jpeg': 'i-lucide-image', 'png': 'i-lucide-image',
  'gif': 'i-lucide-image', 'webp': 'i-lucide-image', 'svg': 'i-lucide-image',
  'bmp': 'i-lucide-image', 'ico': 'i-lucide-image', 'avif': 'i-lucide-image',
  'heic': 'i-lucide-image', 'heif': 'i-lucide-image', 'tiff': 'i-lucide-image',
  'tif': 'i-lucide-image', 'raw': 'i-lucide-image', 'psd': 'i-lucide-image',
  // 视频
  'mp4': 'i-lucide-film', 'mov': 'i-lucide-film', 'avi': 'i-lucide-film',
  'mkv': 'i-lucide-film', 'wmv': 'i-lucide-film', 'webm': 'i-lucide-film',
  'flv': 'i-lucide-film', '3gp': 'i-lucide-film', 'm4v': 'i-lucide-film',
  'mpeg': 'i-lucide-film', 'mpg': 'i-lucide-film',
  'ogv': 'i-lucide-film', 'divx': 'i-lucide-film',
  // 音频
  'mp3': 'i-lucide-music', 'wav': 'i-lucide-music', 'flac': 'i-lucide-music',
  'aac': 'i-lucide-music', 'ogg': 'i-lucide-music', 'wma': 'i-lucide-music',
  'm4a': 'i-lucide-music', 'opus': 'i-lucide-music', 'ape': 'i-lucide-music',
  'mid': 'i-lucide-music', 'midi': 'i-lucide-music', 'aiff': 'i-lucide-music',
  // 压缩包
  'zip': 'i-lucide-file-archive', 'rar': 'i-lucide-file-archive',
  '7z': 'i-lucide-file-archive', 'tar': 'i-lucide-file-archive',
  'gz': 'i-lucide-file-archive', 'bz2': 'i-lucide-file-archive',
  'xz': 'i-lucide-file-archive', 'zst': 'i-lucide-file-archive',
  'iso': 'i-lucide-file-archive', 'dmg': 'i-lucide-file-archive',
  'cab': 'i-lucide-file-archive',
  // 文档
  'pdf': 'i-lucide-file-text', 'doc': 'i-lucide-file-type',
  'docx': 'i-lucide-file-type', 'odt': 'i-lucide-file-type',
  'rtf': 'i-lucide-file-text', 'txt': 'i-lucide-file-text',
  'md': 'i-lucide-file-text', 'markdown': 'i-lucide-file-text',
  'epub': 'i-lucide-file-text', 'mobi': 'i-lucide-file-text',
  'azw3': 'i-lucide-file-text',
  // 表格
  'xls': 'i-lucide-file-spreadsheet', 'xlsx': 'i-lucide-file-spreadsheet',
  'csv': 'i-lucide-file-spreadsheet', 'ods': 'i-lucide-file-spreadsheet',
  'xlsm': 'i-lucide-file-spreadsheet', 'xlsb': 'i-lucide-file-spreadsheet',
  // 演示
  'ppt': 'i-lucide-presentation', 'pptx': 'i-lucide-presentation',
  'odp': 'i-lucide-presentation', 'key': 'i-lucide-presentation',
  // 代码
  'js': 'i-lucide-file-code', 'ts': 'i-lucide-file-code',
  'jsx': 'i-lucide-file-code', 'tsx': 'i-lucide-file-code',
  'py': 'i-lucide-file-code', 'html': 'i-lucide-file-code',
  'css': 'i-lucide-file-code', 'scss': 'i-lucide-file-code',
  'less': 'i-lucide-file-code', 'json': 'i-lucide-file-code',
  'xml': 'i-lucide-file-code', 'yaml': 'i-lucide-file-code',
  'yml': 'i-lucide-file-code', 'sh': 'i-lucide-file-code',
  'bash': 'i-lucide-file-code', 'sql': 'i-lucide-file-code',
  'vue': 'i-lucide-file-code', 'svelte': 'i-lucide-file-code',
  'php': 'i-lucide-file-code', 'rb': 'i-lucide-file-code',
  'go': 'i-lucide-file-code', 'rs': 'i-lucide-file-code',
  'java': 'i-lucide-file-code', 'swift': 'i-lucide-file-code',
  'c': 'i-lucide-file-code', 'cpp': 'i-lucide-file-code', 'h': 'i-lucide-file-code',
  'cs': 'i-lucide-file-code', 'kt': 'i-lucide-file-code',
  'dart': 'i-lucide-file-code', 'toml': 'i-lucide-file-code',
  // 可执行
  'exe': 'i-lucide-package', 'msi': 'i-lucide-package',
  'apk': 'i-lucide-package', 'pkg': 'i-lucide-package',
  'rpm': 'i-lucide-package', 'deb': 'i-lucide-package',
  'appimage': 'i-lucide-package',
  // 字体
  'ttf': 'i-lucide-type', 'otf': 'i-lucide-type',
  'woff': 'i-lucide-type', 'woff2': 'i-lucide-type',
  'eot': 'i-lucide-type',
  // CAD / 3D
  'dwg': 'i-lucide-cuboid', 'dxf': 'i-lucide-cuboid',
  'stl': 'i-lucide-cuboid', 'obj': 'i-lucide-cuboid',
  'step': 'i-lucide-cuboid', 'stp': 'i-lucide-cuboid',
  '3ds': 'i-lucide-cuboid', 'blend': 'i-lucide-cuboid',
  // 数据库
  'db': 'i-lucide-database', 'sqlite': 'i-lucide-database',
  'sqlite3': 'i-lucide-database', 'mdb': 'i-lucide-database'
}

/** 将图标分类 */
export const ICON_CATEGORIES: Record<string, { label: string, icon: string, exts: string[] }> = {
  image: { label: 'Image', icon: 'i-lucide-image', exts: ['jpg', 'png', 'gif', 'svg', 'webp'] },
  video: { label: 'Video', icon: 'i-lucide-film', exts: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
  audio: { label: 'Audio', icon: 'i-lucide-music', exts: ['mp3', 'wav', 'flac', 'aac', 'ogg'] },
  archive: { label: 'Archive', icon: 'i-lucide-file-archive', exts: ['zip', 'rar', 'tar.gz', '7z', 'iso'] },
  doc: { label: 'Document', icon: 'i-lucide-file-type', exts: ['docx', 'odt', 'pdf', 'txt', 'md'] },
  sheet: { label: 'Spreadsheet', icon: 'i-lucide-file-spreadsheet', exts: ['xlsx', 'csv', 'ods'] },
  slide: { label: 'Presentation', icon: 'i-lucide-presentation', exts: ['pptx', 'odp', 'key'] },
  code: { label: 'Code', icon: 'i-lucide-file-code', exts: ['js', 'ts', 'py', 'html', 'vue'] },
  exe: { label: 'Executable', icon: 'i-lucide-package', exts: ['exe', 'apk', 'dmg'] },
  font: { label: 'Font', icon: 'i-lucide-type', exts: ['ttf', 'otf', 'woff'] },
  cad: { label: 'CAD / 3D', icon: 'i-lucide-cuboid', exts: ['dwg', 'stl', 'obj', 'blend'] },
  db: { label: 'Database', icon: 'i-lucide-database', exts: ['db', 'sqlite', 'mdb'] }
}

/** 根据文件名返回对应 Lucide 图标 */
export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return FILE_ICON_MAP[ext] || 'i-lucide-file'
}
