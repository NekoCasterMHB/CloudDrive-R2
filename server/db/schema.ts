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
