---
date: '2026-01-10T16:31:10+09:00'
draft: false
tags: ['tech', 'chrome', 'web api', 'wasm', 'catch-up-2025-2026-vacation']
description: 'Webブラウザだけで完結する便利なツールが5つ作りましたので、そのご紹介'
title: 'ブラウザだけで完結する自作ツール5つの紹介'
---

暇な時は[Web API](https://developer.mozilla.org/ja/docs/Web/API)や[Chrome API](https://developer.chrome.com/docs/extensions/reference/api?hl=ja)を読むようになった、よ〜んです。

Webブラウザだけで完結する便利ツールを5つ作ってみたのでご紹介します。

## [Descriptio生成くん(Summarizer APIが使用できるChromeのみ対応)](/tools/description-generator/)

記事のデスクリプションを自動で作りたくて作ったツール。

本文を貼り付けると、Chromeの[Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api?hl=ja)で要約して100文字以内にトリミングしたDescriptionを返すツール。

Chrome 138以降のみ対応。

## [OGP画像作るくん](/tools/ogp-generator/)

OGP画像を統一されたデザインで作成したくて作った。

Canvasで1200x630の画像を描画し、グラデーション背景・装飾の円・薄いグリッドを重ねてタイトルを中央配置する。タイトルは自動で折り返し＆縮小し、最後にPNGとしてダウンロードできる。

## [UUID v7生成くん](/tools/uuidv7-generator/)

画像を埋め込むときのファイル名をUUID v7にリネームしたくて作った。

`crypto.getRandomValues` と `Date.now()` を使ってv7の構造に合わせたUUIDを生成し、ワンクリックでコピーできる。完全にブラウザ内で完結するので、ちょっとした作業の時に便利。

## [サクッとPython REPLくん](/tools/python-repl/)

せっかくなので[Pyodide(PythonのWASM)](https://pyodide.org/en/stable/)を使って何か作りたかったので作成。

CDNからPyodideを読み込み、ブラウザ内でPythonコードを実行できるミニREPLにした。標準出力とエラーを同じ欄に出し、手軽に試せるようにしている。

## [活動みえる化くん](/tools/visualizing-progress)

GitHubのコントリビューショングラフ的な見える化をやってみたかったので作った。

`/index.xml` のブログ投稿と `/data/output.jsonl` の活動ログを読み込み、日付ごとに集計してヒートマップを描画する。複数タイプが重なる日はグラデーション表示、ホバーで内訳をツールチップで出す。

## まとめ(？)

触ってみてフィードバックとかあれば、[X](https://x.com/Tesla_yoon)までお願いします。

ブラウザだけでまだまだ遊べますね、PWAで何か作ったりもしてみようかなと思いました。

ではでは
