---
date: '2025-12-31T18:24:50+09:00'
draft: false
tags: ['tech', 'prompt-api', 'hono', 'htmx', 'catch-up-2025-2026-vacation']
description: 'ChromeのPrompt APIやIndexedDBなどを使用して、Chromeだけで画像を検索できるアプリケーションを作ってみました。'
title: 'ChromeのPrompt APIを使い尽くす'
---

よ〜んです。

今回は、Chrome Prompt APIを使い尽くそうと思います。

## Chrome Prompt APIとは

Chrome 138から利用可能になった、ブラウザ内蔵のLLMです。Gemini Nanoがローカルで動作するため、オフラインでも推論ができます。

有効化するには以下のフラグを設定する必要があります

- `chrome://flags/#prompt-api-for-gemini-nano`
- `chrome://flags/#optimization-guide-on-device-model`

さらに `chrome://components` から「Optimization Guide On Device Model」をダウンロードしておく必要があります。

## IndexedDB

ブラウザ内蔵のNoSQLデータベースです。今回は画像のデータをそのまま保存するために使っています。

```javascript
const req = indexedDB.open('image-db', 1)
req.onupgradeneeded = () => {
  req.result.createObjectStore('images', { keyPath: 'id' })
}
```

画像データは以下の形式で保存しています：

```javascript
{
  id: crypto.randomUUID(),
  fileName: file.name,
  mimeType: file.type,
  blob: file,           // 画像のBlobをそのまま保存
  annotation: '',       // AIが生成したタグ
  createdAt: Date.now()
}
```

## 今回作るアプリケーション

「画像タグ検索」というアプリを作りました。画像をアップロードすると、AIが自動でタグを生成してくれて、自然言語で検索できるというものです。

よくネットミームの画像をチャットを貼ったりするのですが、画像に何が写ってるかなどの記憶はあるのに、なんて検索したらいいかわからない時ってありますよね。

ファイル名は適当だし、フォルダ分けもしてないし。「あの猫のやつ」「サイバー空間で変なサングラスしてパソコン触ってる人」みたいな曖昧な記憶で探せたらいいなと思って作りました。

- Chromeだけで動作
  - サーバーへの通信なし。画像データもタグの生成処理もすべてブラウザ内で完結
- 完全無料
  - ローカルLLMなのでAPIキーも課金も不要。何回使ってもタダ
- 自然言語で曖昧検索可能
  - 「生き物」で検索すると猫や犬の画像がヒット。タグの完全一致じゃなくて意味的に検索できる
- バックエンドレス
  - REST API風のエンドポイントはあるけど、実体はService Worker

### アーキテクチャ

```mermaid
flowchart TB
    subgraph Chrome["Chrome Browser"]
        subgraph MainThread["Main Thread"]
            htmx["htmx"]
            PromptAPI["Prompt API<br/>(Gemini Nano)"]
        end
        subgraph Worker["Service Worker"]
            Hono["Hono<br/>(Router)"]
        end
        subgraph Storage["Storage"]
            IDB["IndexedDB<br/>(画像 + タグ)"]
        end
    end

    htmx -->|"POST /api/images"| Hono
    htmx -->|"GET /api/search"| Hono
    Hono -->|"MessageChannel"| PromptAPI
    PromptAPI -->|"タグ生成・検索"| Hono
    Hono -->|"保存・取得"| IDB
    Hono -->|"HTML Response"| htmx
```

Prompt APIはService Worker内で使えないので、MessageChannelでメインスレッドにプロキシしています。

## 実装していく

### DB

IndexedDBのラッパーを作りました。

```javascript
export async function getAllImages() {
  const db = await openDB()
  const store = db.transaction('images', 'readonly').objectStore('images')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
```

### Routing

Service Worker内でHonoを使ってルーティングしています。`/api/*` へのリクエストをインターセプトして処理します。

```javascript
import { Hono } from 'https://esm.sh/hono@4'

const app = new Hono()

app.get('/api/images', async (c) => {
  const all = await getAllImages()
  return c.html(renderList(all))
})

app.post('/api/images', async (c) => {
  const files = (await c.req.formData()).getAll('file')
  for (const file of files) {
    await saveImage(file, await requestAnnotation(file))
  }
  return c.html(renderList(await getAllImages()))
})

self.addEventListener('fetch', (e) => {
  if (new URL(e.request.url).pathname.startsWith('/api')) {
    e.respondWith(app.fetch(e.request))
  }
})
```

### Prompt API

サービスワーカーでPrompt APIにアクセスできないのでMessageChannelを使ってService Workerとメインスレッド間で通信しています。

```javascript
// メインスレッド側
const channel = new MessageChannel()
channel.port1.onmessage = handleMessage
navigator.serviceWorker.controller?.postMessage({ type: 'INIT_PORT' }, [channel.port2])

function handleMessage(e) {
  if (e.data.type === 'ANNOTATE') {
    annotateImage(e.data.blob).then(annotation => 
      e.currentTarget.postMessage({ id: e.data.id, annotation })
    )
  }
}
```

画像のアノテーション生成はこんな感じ：

```javascript
async function annotateImage(blob) {
  const session = await self.LanguageModel.create({
    expectedInputs: [{ type: 'image' }, { type: 'text' }],
    languageCode: 'ja'
  })
  
  const file = new File([blob], 'image.jpg', { type: blob.type })
  let result = ''
  
  for await (const chunk of session.promptStreaming([{
    role: 'user',
    content: [
      { type: 'text', value: 'この画像に含まれる要素をタグ形式で列挙してください。' },
      { type: 'image', value: file }
    ]
  }])) {
    result += chunk
  }
  
  session.destroy()
  return result
}
```

検索もLLMを使ってあいまいなマッチングをしています。「生き物」で検索すると猫や犬の画像がヒットするようになっています。

### フロント

htmxとtailwindを使って実装しました。ここら辺はKiroにお任せです。

```html
<input type="file" accept="image/*" multiple
  hx-post="/api/images"
  hx-target="#imageList"
  hx-encoding="multipart/form-data">

<input type="search" name="q" placeholder="自然言語で検索..."
  hx-get="/api/search"
  hx-trigger="input changed delay:500ms"
  hx-target="#imageList">
```

## 使ってみる

適当なミーム画像を登録していきます。

![](/images/019b7460-2493-7ebc-b96b-2429aa5cb926.png)

いい感じにタグが生成されていますね。

![](/images/019b7460-2493-707d-b1dd-3552624ebb14.png)

タグは`眼鏡`で登録されていますが、`メガネ`で検索することができました。

![](/images/019b7460-2493-7d3c-8456-665cd9904d07.png)

一般的な名詞以外の表記揺れも吸収してくれるようです。

jsは十分一般的な名詞の可能性もあります。

## まとめ

Chrome Prompt APIを使って画像タグ検索アプリを作ってみました。

ローカルLLM侮ってました。画像認識できるし、意味的な検索もちゃんと動きました。しかもタダ🉐

Hono(Service Worker) + IndexedDB の組み合わせも検証できてよかったなと思います、バックエンドなしでREST APIっぽいアーキテクチャが作れるのは夢があます

今回作成した[画像タグ検索](/image-finder/)はすでにこちらのサイト内にホスティングしています、ぜひ使ってみてください。

よ〜んには何も飛んで来ませんが、変な画像とかは保存とかは怒られるかもしれませんw

[画像タグ検索](/image-finder/)
