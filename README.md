# 漢文句法（Phase 1）

## 起動
- 手元で確認: このフォルダで `python3 -m http.server 8000` → http://localhost:8000
- スマホ: GitHub Pages等にフォルダ一式を置いて開く（HTTPS必須。ファイルを直接開くと動きません）
- インストール: Android Chromeで開く → メニュー →「ホーム画面に追加」／「アプリをインストール」

## ファイル
- index.html / style.css / app.js … アプリ本体
- data/grammar.json … 分類(tags)と句法(grammar)
- data/sentences.json … 例文。occ=句法の登場位置（白文の文字位置start/end）。passage_id は将来の文章読解用
- sw.js / manifest.webmanifest / icon-*.png … PWA（オフライン・インストール）
- 学習記録はアプリ側（IndexedDB）に保存され、JSONとは別管理

## データの追加・修正
1. grammar.json に句法を追加（id は重複させない。tags は tags の id、similar は句法id）
2. sentences.json に例文を追加（occ の g は句法id）
3. 確認済みの項目は `"verified": true` に変更
4. sw.js の `C='kanbun-v1'` を `v2` に上げて再公開（端末のキャッシュが更新される）
