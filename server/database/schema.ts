import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// 文件夹
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// 文件
export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  folderId: text('folder_id'),
  filename: text('filename').notNull(),
  objectKey: text('object_key').notNull(),
  size: integer('size').notNull().default(0),
  contentType: text('content_type').notNull().default('application/octet-stream'),
  etag: text('etag'),
  thumbnailKey: text('thumbnail_key'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// 回收站
export const trash = sqliteTable('trash', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fileId: text('file_id'),
  folderId: text('folder_id'),
  name: text('name').notNull(),
  originalPath: text('original_path').notNull(),
  size: integer('size').notNull().default(0),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  isFolder: integer('is_folder', { mode: 'boolean' }).notNull().default(false),
  objectKey: text('object_key')
})

// 上传会话表（R2 Multipart Upload 会话，支持断点续传）
export const uploadSessions = sqliteTable('upload_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  folderId: text('folder_id'),
  uploadId: text('upload_id').notNull(), // R2 Multipart Upload ID
  objectKey: text('object_key').notNull(),
  filename: text('filename').notNull(),
  fileSize: integer('file_size').notNull(),
  contentType: text('content_type').notNull().default('application/octet-stream'),
  status: text('status').notNull().default('pending'), // pending | uploading | completed | failed | cancelled
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

// 上传分片表
export const uploadParts = sqliteTable('upload_parts', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  partNumber: integer('part_number').notNull(),
  etag: text('etag'),
  size: integer('size').notNull().default(0),
  status: text('status').notNull().default('pending') // pending | uploading | completed | failed
})

// 用户设置（key-value，value 为 JSON 字符串，key 与 user_id 组合唯一）
export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// 用户组（管理员统一配置：存储上限 / 可否改密码 / 分片大小等）
export const userGroups = sqliteTable('user_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  storageLimit: integer('storage_limit').notNull().default(0), // 0 = 无限制
  canChangePassword: integer('can_change_password', { mode: 'boolean' }).notNull().default(true),
  uploadChunkSize: integer('upload_chunk_size').notNull().default(10 * 1024 * 1024), // 0 = 跟随个人默认
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// 全局系统设置（key-value，value 为 JSON 字符串；如 allow_register 是否允许新用户注册）
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// 分享（支持文件/文件夹混选，items 为 JSON：[{ id, type, name }]）
export const shares = sqliteTable('shares', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  token: text('token').notNull(), // 唯一分享码
  password: text('password'), // 密码哈希（可选，null 表示无密码）
  passwordPlain: text('password_plain'), // 密码明文（仅供分享管理中展示/复制；校验仍用 password 哈希）
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 可选，null 表示永久
  items: text('items').notNull(), // JSON 字符串
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
