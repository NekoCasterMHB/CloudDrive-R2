# CloudDrive R2

個人用プライベートクラウドドライブ PWA（Nuxt 4 + Cloudflare Workers + D1 + R2）。

## デモ

- テストサイト: （準備中）

## テストアカウント

| 種別 | ユーザー名 | パスワード | 備考 |
|------|-----------|-----------|------|
| テストユーザー | `test` | `test` | ストレージ上限 **100MB 固定**（変更不可） |

> テストユーザーはストレージ上限が 100MB に固定されており、設定画面から変更することはできません。

## 機能

- ファイル / フォルダのアップロード・ダウンロード・移動・コピー・削除（ごみ箱）
- マルチユーザー対応（ユーザーごとにファイル・フォルダを完全分離）
- メール検証コード / ユーザー名 + パスワードでのログイン
- 共有機能（ファイル / フォルダをリンクで共有）
  - パスワード保護（6 桁 PIN、一度入力すれば次回以降は入力不要）
  - 有効期限設定（時間 / 日、最大 100、無期限も可）
  - 共有リンク管理（共有一覧・取消・リンクコピー）
  - 公開ページでの複数選択 + ZIP 一括ダウンロード、ファイルのプレビュー
- ファイル索引（IndexedDB にローカル保存、毎日自動で全量同期）
- プレビューキャッシュ（IndexedDB、最大容量・対象タイプを設定可能）
- ソート機能（名前 / サイズ / タイプ / 更新日時、昇順・降順）
- 多言語対応（日本語 / 中文 / English）
- ダークモード対応
- PWA

## 技術スタック

- Nuxt 4 + Vue 3 + Nuxt UI v4
- Cloudflare Workers + D1 + R2
- better-auth（メール OTP + ユーザー名 / パスワード認証）
- JSZip（共有 ZIP 一括ダウンロード）
- TypeScript + ESLint

## 開発環境デバッグ（D1 / R2 バインディング統一）

リモート API（d1-http / S3）は使わず、Cloudflare bindings（`env.DB`、`env.R2`）経由で
データベースとオブジェクトストレージにアクセスします。ローカル開発と本番は同じコードパスです。

- `pnpm dev`：Nitro が `wrangler.getPlatformProxy()` でローカル Miniflare を起動し、
  ルートの `wrangler.toml` に基づく**ローカル D1 + R2 バインディング**を提供します
  （`.wrangler/state/v3` に永続化。クラウドにはアクセスしません）。
  D1 マイグレーションは NuxtHub がローカル D1 に自動適用します（`server/db/migrations/sqlite/`）。
- `pnpm build && pnpm dev:remote`：`wrangler dev --remote` で**リモート**の D1 / R2 に接続してデバッグ。
- デプロイ：`pnpm build` 後に `wrangler deploy`（または NuxtHub 経由）。コードパスは同一です。

| リソース | バインディング | ローカル永続化 |
|---------|--------------|---------------|
| データベース | `env.DB`（D1） | `.wrangler/state/v3` |
| オブジェクトストレージ | `env.R2`（R2 Bucket） | `.wrangler/state/v3` |

> 注：R2 binding は S3 プリサイン URL をサポートしていないため、分割アップロードは
> Worker 経由（`POST /api/upload/part` → `env.R2.uploadPart`）で行います。

---

## セットアップ

依存関係をインストールします:

```bash
pnpm install
```

## 開発サーバー

`http://localhost:3000` で開発サーバーを起動します:

```bash
pnpm dev
```

## 本番ビルド

本番用にビルドします:

```bash
pnpm build
```

本番ビルドをローカルでプレビュー:

```bash
pnpm preview
```

## デプロイ

```bash
pnpm build
wrangler deploy
```

詳細は [Nuxt デプロイメントドキュメント](https://nuxt.com/docs/getting-started/deployment) を参照してください。

## Renovate 連携

[Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) をリポジトリにインストールすれば準備完了です。
