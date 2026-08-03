-- ============================================================
-- CloudDrive R2 - 数据库初始化脚本（完整版）
-- 整合自 server/db/migrations/sqlite/ 0000~0005
-- 包含：文件/文件夹、回收站、上传、认证（better-auth）、用户设置、分享
-- ============================================================

-- ── 文件（0000）────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`etag` text,
	`thumbnail_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- ── 文件夹（0000）──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- ── 回收站（0001）──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `trash` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_id` text,
	`folder_id` text,
	`name` text NOT NULL,
	`original_path` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`is_folder` integer DEFAULT false NOT NULL,
	`object_key` text
);

-- ── 上传分片（0002）────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `upload_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`part_number` integer NOT NULL,
	`etag` text,
	`size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);

-- ── 上传会话（0002，R2 Multipart Upload 断点续传）────────────
CREATE TABLE IF NOT EXISTS `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`upload_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`file_size` integer NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);

-- ── 用户（0003，better-auth）───────────────────────────────
CREATE TABLE IF NOT EXISTS `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);

-- ── 会话（0003，better-auth）───────────────────────────────
CREATE TABLE IF NOT EXISTS `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);

-- ── 账号（0003，better-auth，含密码哈希）────────────────────
CREATE TABLE IF NOT EXISTS `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);

-- ── 验证码（0003，better-auth emailOTP）────────────────────
CREATE TABLE IF NOT EXISTS `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);

-- ── 用户设置（0004，key-value JSON）────────────────────────
CREATE TABLE IF NOT EXISTS `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);

-- ── 分享（0005，文件/文件夹混选）────────────────────────────
CREATE TABLE IF NOT EXISTS `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`password` text,
	`password_plain` text,
	`expires_at` integer,
	`items` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `shares_token_unique` ON `shares` (`token`);
