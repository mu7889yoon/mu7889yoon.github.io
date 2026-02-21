---
date: '2025-12-29T10:13:53+09:00'
draft: false
tags: ['tips', 'tech', 'hono', 'catch-up-2025-2026-vacation']
description: 'Honoを使用してLambdalithの構成でバックエンドを記述してみます。'
title: 'Honoでカウンターのバックエンドを作る'
---

[Serverless Days 2025](https://tokyo.serverlessdays.io/)ぐらいからエッジコンピューティングにお熱なよ〜んです。

[Hono[炎]](https://hono.dev/)というフレームワークがあるのは存じ上げておりましたが、最近エッジコンピューティングに興味を持ち始めたので、触ってみます。

以下のようなコンセプトらしいです。

```
Ultrafast & Lightweight
>> めちゃ速くてめちゃ軽いで
The router RegExpRouter is really fast. The hono/tiny preset is under 14kB. Using only Web Standard APIs.
>> 正規表現を使うルーターはめちゃ速いし、hono/tinyプリセットは14KBしかないねん。なんでか言うとWeb標準APIを使ってるからや
Multi-runtime
>> どこでも動くで
Works on Cloudflare, Fastly, Deno, Bun, AWS, or Node.js. The same code runs on all platforms.
>> どこでも同じコードで動かすことできるで
Batteries Included
>> 電池入り
Hono has built-in middleware, custom middleware, third-party middleware, and helpers. Batteries included.
>> 組み込みのミドルウェアとかヘルパーあるで、電池入っとるから買わんでええよ
Delightful DX
>> 楽しいDX
Super clean APIs. First-class TypeScript support. Now, we've got "Types".
>> めっちゃ綺麗なAPI、TypeScriptのサポートは一流やし、Typesも使えるようになったで
```

[先日の記事](/posts/creating-a-counter-with-htmx-and-server-sent-events/)のバックエンドのコードをHonoを使って書き換えてみようと思います。

ちなみに全然関係ないですが、私は「青く燃える炎」が好きです。

## Honoで実装してみた

[Hono - Web API](https://hono.dev/examples/web-api)を参考に、実装していきます。

学生の時に、Express.jsを少し触っていたので、抵抗なく書くことができそうです。

### 書き換える対象のソースコード

[increment/index.mjs](https://github.com/mu7889yoon/examples/blob/main/htmx-sse-counter/src/lambda/increment/index.mjs)

[sse/index.mjs](https://github.com/mu7889yoon/examples/blob/main/htmx-sse-counter/src/lambda/sse/index.mjs)

### ルーティング

前回の記事ではAPI Gatewayにルーティングを任せていましたが、今回はルーティングもアプリケーション側で管理していきます。いわゆるLambdalithという構成ですね。

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import { getCounterValue, incrementCounter } from './services/counter.js'

const POLL_INTERVAL_MS = 1000

const app = new Hono()

app.use('/*', cors())

app.post('/api/increment', async (c) => {
    // 省略
})

app.get('/api/events', async (c) => {
    // 省略
})

const port = 8080
console.log(`Server starting on port ${port}`)
serve({ fetch: app.fetch, port })

export default app

```

### increment部分

ちょっと気になったので、`c`について書きます。

`c`は`Context`の略で、リクエストやレスポンスを操作するためのオブジェクトです。  
`c.json()`でJSON形式のレスポンスをサッと返せたり、`c.req`でリクエスト情報を簡単に扱えたりと、直感的なインターフェースでいいな〜と思ってます。

```ts
app.post('/api/increment', async (c) => {
  try {
    const count = await incrementCounter()
    return c.json({ count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: 'Failed to increment counter', message }, 500)
  }
})
```

`incrementCounter()`は、はほぼそのままの実装ですのでスキップします。

### sse部分

`awslambda.streamifyResponse`は使用せず、Honoの機能を使用します。

[Hono - Streaming Helper](https://hono.dev/docs/helpers/streaming)を見ながら実装しました。

正直なところ、ポーリングして値が変わったら都度フロントに流してるだけなんだけど、「こんなんでちゃんと動くんか？」と思いながら書いてたら普通にいい感じに動きました。

HonoのstreamSSE便利なのと、型が綺麗に補完効くので実装ストレスなく書けました。

```ts
app.get('/api/events', async (c) => {
  return streamSSE(c, async (stream) => {
    let lastCount: number | null = null
    try {
      const initialCount = await getCounterValue()
      lastCount = initialCount
      await stream.writeSSE({
        event: 'counter',
        data: `<div id="counter">${initialCount}</div>`
      })
    } catch (error) {
      console.error('Failed to get initial counter value:', error)
      await stream.writeSSE({
        event: 'error',
        data: 'Failed to get initial counter value'
      })
      return
    }

    while (true) {
      await stream.sleep(POLL_INTERVAL_MS)
      
      try {
        const currentCount = await getCounterValue()
        if (currentCount !== lastCount) {
          lastCount = currentCount
          await stream.writeSSE({
            event: 'counter',
            data: `<div id="counter">${currentCount}</div>`
          })
        }
      } catch (error) {
        console.error('Error polling counter value:', error)
      }
    }
  })
})
```

## まとめ

正直なところ、Honoのポテンシャルをフルに発揮できる構成ではなかったと思います。ですが、思っていた以上にサクサクと実装が進んで楽しかったです。

Honoのシンプルさや思想には改めて惹かれました。

次回は、Lambda@Edgeを活用した構成でも試してみたいと思います。
