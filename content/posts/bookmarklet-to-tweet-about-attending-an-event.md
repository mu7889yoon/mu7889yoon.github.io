---
date: '2026-06-16T13:47:46+09:00'
draft: false
tags: ['tech', 'tips', 'bookmarklet']
description: 'X連携変更により、connpassのイベント参加時の自動ポストが使えなくなってしまいました。参加ツイートを手軽に作成するためのブックマークレットを作ったので、セットアップ方法と使い方を紹介します。'
title: 'connpassのイベント参加ツイートをブックマークレットで手軽にする'
---

よ〜んです。

Twitter(X)の仕様変更でconnpassでイベントに参加表明した際にツイートされなくなってしまいました。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">【重要なお知らせ】<br>Xの外部連携仕様変更に伴い、2026年6月中にconnpassの一部X連携機能を順次変更・終了いたします。<br>対象となる主な機能は以下となります。<br><br>・プロフィール画面のXリンクURL形式の変更<br>・受付票画面の印刷用名札表示の終了<br>・イベント公開以外の連動ポスト機能の終了<a href="https://x.com/hashtag/connpass?src=hash&amp;ref_src=twsrc%5Etfw">#connpass</a></p>&mdash; connpass (@connpass_jp) <a href="https://x.com/connpass_jp/status/2062420076129833312?ref_src=twsrc%5Etfw">June 4, 2026</a></blockquote> <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>

従来はイベント参加が完了したら、以下のようなツイートがされていました。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">JAWS-UG大阪 re:Invent re:Cap LT大会 UFOが来たら強制終了 に参加を申し込みました！ <a href="https://t.co/rcDbOJjF4n">https://t.co/rcDbOJjF4n</a> <a href="https://x.com/hashtag/jawsugosaka?src=hash&amp;ref_src=twsrc%5Etfw">#jawsugosaka</a></p>&mdash; よ〜ん (@Tesla_yoon) <a href="https://x.com/Tesla_yoon/status/1999442154528428513?ref_src=twsrc%5Etfw">December 12, 2025</a></blockquote> <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>

「参加を申し込みました。」ツイートによるインプレッションの影響は大きいと思うので、暫定的に一手間加えて呟くことにします。

## セットアップ

1. 適当なページでブックマークを作成する

![](/images/019ececb-1785-7edf-9fb1-39c08dd87134.png)

1. ブックマークを編集する

![](/images/019ececb-52d2-7389-8b0c-f1cadc9f5cf2.png)

1. このコードをURLに貼り付ける

```js
javascript:(()=>{const d=document;const title=(d.querySelector('meta[property="og:title"]')?.content||d.querySelector(%27h1%27)?.innerText||d.title).replace(/\s*-\s*connpass\s*$/,%27%27).trim();const baseUrl=(d.querySelector(%27meta[property="og:url"]%27)?.content||d.querySelector(%27link[rel="canonical"]%27)?.href||location.href).split(%27?%27)[0];const url=baseUrl+%27?utm_campaign=event_participate_to_follower&utm_source=notifications&utm_medium=twitter%27;const text=`${title} に参加を申し込みました！ ${url} #wakate_aws%60;open(%60https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}%60,'_blank');})();
```

![](/images/019ececb-77aa-7f48-944d-8f9dde0905e5.png)

## 使い方

私が実行委員として参加している[JAWS SONIC 2026](https://jaws-ug.connpass.com/event/393837/)を例に使い方を確認してみましょう

1. connpassで参加申し込みする

![](/images/019ececd-80cd-7089-97a8-b2eb03e1201b.png)

1. イベントページに戻る

![](/images/019ececb-944e-7e75-8d3b-94466e551d61.png)

1. 先ほど作成したブックマークを押す

2. ポストする

![](/images/019ececb-ad6d-7257-ae30-9ac746e380e8.png)

## まとめ

「助かったよ」という方は以下の記事でブックマークレット is なんぞやという話をしております。

ではではー

[ブックマークレットとかいう魔法](/posts/bookmarklets-a-kind-of-magic/)
