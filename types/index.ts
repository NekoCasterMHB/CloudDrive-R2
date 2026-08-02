// 共享类型
// ─── 用户 ───
export interface User {
  id: string
  email: string
  storageUsed: number
  storageLimit: number
  createdAt: number
}

// ─── 文件夹 ───
export interface Folder {
  id: string
  parentId: string | null
  name: string
  createdAt: number
}

// ─── 文件 ───
export interface FileInfo {
  id: string
  folderId: string | null
  filename: string
  size: number
  contentType: string
  thumbnailKey: string | null
  createdAt: number
}

// ─── 分享 ───
export interface ShareItem {
  id: string
  type: 'file' | 'folder'
  name: string
}

// ─── 认证 ───
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

// ─── 目录 ───
export interface DirectoryListing {
  folders: Folder[]
  files: FileInfo[]
  parentId: string | null
}

// ─── 上传 ───
export interface UploadInitRequest {
  filename: string
  size: number
  contentType: string
  folderId: string | null
}

export interface UploadInitResponse {
  sessionId: string
  uploadId: string
  objectKey: string
  partSize: number
}
