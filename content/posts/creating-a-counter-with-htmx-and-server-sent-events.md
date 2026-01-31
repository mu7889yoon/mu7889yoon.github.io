+++
date = '2025-12-25T22:06:37+09:00'
draft = false
tags = ['tips', 'tech', 'htmx', 'catch-up-2025-2026-vacation']
description = 'htmxとServer Sent Eventsを使って、簡単なWebアプリケーションを作ります。htmxを使うことで簡単にフロントエンドの処理をかけることがわかりました。'
title = 'htmxとServer Sent Eventsを使ってカウンターを作る'
+++

よ〜んです。

あまりフロントエンド界隈にまで手が伸びていないのですが、タイムラインで[htmx](https://htmx.org/)を見かけたので、触ってみようと思います。

以下のようなコンセプトらしいです、翻訳もしておきました。

```
Why should only <a> & <form> be able to make HTTP requests?
>> なんでaタグとformタグだけがHTTPリクエスト実行できるん？
Why should only click & submit events trigger them?
>> なんでクリック・送信イベントだけがトリガーする必要あるん？
Why should only GET & POST methods be available?
>> なんでGETとPOSTだけ使えるようにしてるん？
Why should you only be able to replace the entire screen?
>> なんで丸っと画面交換しかできひんの？
By removing these constraints, htmx completes HTML as a hypertext
>> こういう制約を取っ払うことで、htmxはHTMLをハイパーテキストにするで
```

フロントエンドよわよわの私でも簡単に触れそうですね（？）

## 今回作成するWebアプリ

今回は複数クライアント間でボタンの押された回数をリアルタイム同期するWebアプリを作ってみます

CRUDしないので、めちゃくちゃシンプルですが、クライアント間で同期するためにServer Sent Eventsを使ってみます。

![](/images/019b55bc-32e5-72ba-820a-093358cc48ff.png)

フレームワークに乗っかっていたとしても、複雑な実装になりそうですね〜

## 早速触ってみる

早速、[公式のexample](https://htmx.org/examples/)にそって触っていきます。

フロントエンド、バックエンド、IaCなど含めて丸っと[htmx-sse-counter](https://github.com/mu7889yoon/examples/tree/main/htmx-sse-counter)にpushしております。

### カウントボタンを作る

バックエンドに`POST`リクエストを投げるボタンを作ってみます。

```html
<button hx-post="/api/increment" hx-swap="none">+1</button>
```

なんとこれだけ...流石にあっけないので、リクエストが完了するまで`disabled`にします。

```html
<button hx-post="/api/increment" hx-swap="none">+1</button>    
<script>
    document.body.addEventListener('htmx:beforeRequest', function(e) {
            if (e.detail.elt.tagName === 'BUTTON') {
                e.detail.elt.disabled = true;
            }
        })
    document.body.addEventListener('htmx:afterRequest', function(e) {
            if (e.detail.elt.tagName === 'BUTTON') {
                e.detail.elt.disabled = false;
            }
        })
</script>
```

フロントエンドよわよわの私でもこれぐらいは余裕で書けますwwwとか調子に乗っていた矢先、公式ドキュメントを読んでいると、[hx-disabled-elt](https://htmx.org/attributes/hx-disabled-elt/)なる属性を見つけました。

```html
<button hx-post="/api/increment" hx-swap="none" hx-disabled-elt="this">+1</button>
```

...(言葉が出ません)

### カウント数をSSEで受け取る部分を作る

SSEの機能は拡張機能として実装されているようです。

[htmx Server Sent Event (SSE) Extension](https://htmx.org/extensions/sse/)

流石にちょっとは複雑な実装になるんじゃないの？？？とか思いながら、Usageを見て実装してみます。

```html
<div hx-ext="sse" sse-connect="/api/events">
    <div id="counter" sse-swap="counter">0</div>    
</div>
```

以上です、シンプルすぎる...

### 実際の画面

![](/images/019b55d8-3987-7b72-89d3-a6338ac18c95.gif)

フロントエンドはCloudFront+S3に、バックエンドはLambdaにデプロイしています。

カウント数はDynamoDBに持たせています。(もっと良い方法ある気がするが、一旦)

## 触ってみて

とにかく手軽...`<script>`を使わずにここまで実装できるとは思っていませんでした。

個人使用のレベルではデメリットがなさそうなので、進んで使っていこうと思います。

## まとめ

本記事ではhtmxとServer Sent Eventsを使って、複数クライアント間でリアルタイム同期するカウンターを作ってみました。

- htmxはHTML属性だけでインタラクティブな機能を実装できた
  - SSE拡張を使えば、`sse-connect`と`sse-swap`だけで使えてしまう
  - 他にも、htmx開発チームがサポートする拡張機能やコミュニティが開発する拡張機能ある
- フロントエンドよわよわでも、サクサク手軽にWebアプリが作れた

ここまで読んでくださりありがとうございました。

ソースコードは[htmx-sse-counter](https://github.com/mu7889yoon/examples/tree/main/htmx-sse-counter)にございます。

### 余談 htmxの開発チーム、楽しそう

htmxの公式サイトにはフッターに~~皮肉モリモリの~~俳句が載っていたり、[meme集](https://htmx.org/essays/#memes)があったりします。

こういう遊び心があるプロジェクト、好きです。
