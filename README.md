# QR入場者カウンター

## 仕組み

- `/index.html` = QRから開く来場者ページ。画像だけ表示。
- `/admin.html` = 運営ページ。画像 + 現在人数 + 累計人数。
- 同じブラウザでは `localStorage` の visitor ID を使って2回目以降をカウントしない。
- 人数データはGitHubではなくCloudflare D1に保存。
- 運営ページはCloudflare Workerのパスワード認証を使う。

## 1. GitHub Pages

このフォルダの内容をGitHubリポジトリのルートに置きます。

`assets/main.jpg` を表示したい画像に差し替えます。

GitHubの Settings → Pages から、`main` ブランチのルートを公開元に設定します。
GitHub Pagesはリポジトリから静的サイトを公開できます。

## 2. Cloudflare D1

CloudflareでD1データベースを作成し、`worker/schema.sql` を実行します。

テーブルは `visitors` と `counters` の2つです。

## 3. Worker

`worker/wrangler.toml` の `database_id` を自分のD1のIDに変更します。

Workerをデプロイし、D1 binding名が `DB` になっていることを確認します。

次のSecret/Environment Variablesを設定してください。

- `ADMIN_PASSWORD` = 運営ページのログインパスワード
- `ADMIN_SECRET` = 長くランダムな秘密文字列
- `ALLOWED_ORIGIN` = GitHub PagesのURL
  - 例: `https://YOURNAME.github.io`

## 4. GitHub側のAPI URL

`assets/config.js` の

`https://YOUR-WORKER.workers.dev`

を、デプロイしたWorkerのURLに変更します。

## 5. URL

来場者:
`https://YOURNAME.github.io/REPOSITORY/`

運営:
`https://YOURNAME.github.io/REPOSITORY/admin.html`

## 注意

この方式で「同じ人」を完全に判定できるわけではありません。
ブラウザのデータを削除した場合、シークレットモード、別ブラウザ、別端末では別の来場者として扱われます。

本当に「1人1回」を保証する必要がある場合は、QR入場時にスタッフが1回だけ発行する入場券IDなど、別の仕組みが必要です。
