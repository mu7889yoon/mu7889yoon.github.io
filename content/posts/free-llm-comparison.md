---
date: '2026-04-04T19:05:58+09:00'
draft: false
tags: ['tech','さくらのAI','cloudflare','ionet','google-ai-studio','ionet','openrouter']
description: '無料のLLMサービスを徹底比較！各サービスの利用上限や、実際に試した際の推算値を解説します。'
title: '無料LLM API'
---

お🉐大好きなよ〜んです。

LLMのAPIが気軽に呼び出せるようになってきましたが、お金が湯水の如く消えていっている気がします。

本日は無料でLLMを利用できるサービスをピックアップしました。

**この記事は2026/04/04時点のデータを元に作成しています。**

## 無料LLMを提供しているサービス

現時点(2026/04/04)の情報＆ざっくり調査です。

### さくらのAI

日本国内のデータセンターで完結するそう、さくらのAIを使うためにはクレカ登録が必要。

[さくらのAI](https://www.sakura.ad.jp/aipf/)

[さくらのAI - モデル料金](https://www.sakura.ad.jp/aipf/ai-engine/#:~:text=%E3%83%89%E3%82%AD%E3%83%A5%E3%83%A1%E3%83%B3%E3%83%88%E3%82%92%E8%A6%8B%E3%82%8B-,%E6%96%99%E9%87%91,-%E3%82%AB%E3%83%86%E3%82%B4%E3%83%AA%E3%83%BC)

### Cloudflare

ただでさえいろいろ無料で使ってるのに、LLMも無料で使っちゃっていいんですか？いいんですね？ありがとうございます。

[Cloudflare](https://www.cloudflare.com/)

[Pricing · Cloudflare Workers AI docs](https://developers.cloudflare.com/workers-ai/platform/pricing/)

### Google AI Studio

GeminiやGemmaなど利用できます。Gemmaとかはバグか？ってぐらい呼び出せます。

[Google AI Studio](https://ai.google.dev/aistudio)

[Gemini Developer API の料金  |  Gemini API  |  Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing)

### IO.net

オープンウェイトなモデルを呼び出せる、LlamaやDeepSeek、Qwen系など気軽に複数モデルを試せる。

[IO.net](https://io.net/intelligence)

### OpenRouter

IO.netと同じ感じでオープンウェイトなモデルを呼び出せる。
  
[OpenRouter](https://openrouter.ai/)

[API Rate Limits | Configure Usage Limits in OpenRouter | OpenRouter | Documentation](https://openrouter.ai/docs/api/reference/limits)

## どのモデルをどれぐらい呼び出せるのか？

全部書くと大変なので主要なモデル(主観)の対応表を載せておきます。

| モデル名                  | さくらのAI                 | Cloudflare            | Google AI Studio   | IO.net | OpenRouter             |
| --------------------- | ---------------------- | --------------------- | ------------------ | ------ | ---------------------- |
| gpt-oss-120b          | 3000 request/month(※1) | 10,000 neuron/day(※2) | -                  | ⚪︎     | 50 request/day(※2, ※3) |
| Qwen3-Coder-480B-A35B | 3000 request/month(※1) | -                     | -                  | ⚪︎     | 50 request/day(※2, ※3) |
| kimi-k2.5             | -                      | 10,000 neuron/day(※2) | -                  | ⚪︎     | -                      |
| kimi-k2-thinking      | -                      | -                     | -                  | ⚪︎     | -                      |
| glm-4.7-flash         | -                      | 10,000 neuron/day(※2) | -                  | ⚪︎     | -                      |
| glm-4.7               | -                      | -                     | -                  | ⚪︎     | -                      |
| Gemini 2.5 Flash      | -                      | -                     | 10,000 request/day | -      | -                      |
| Gemini 2.5 Pro        | -                      |                       | 1,000request/day   | -      | -                      |
| Gemma 4 31B           | -                      | -                     | 14,400request/day  | -      | -                      |

※1 モデルごとの上限なのか、アカウントごとの条件なのか不明（国弱）
※2 アカウントごとの上限
※3 10クレジット以上購入することで、1000request/dayまで引き上げれる。（悩む）

## 実際に使ってみる

アカウントを登録し、`.env`にシークレット登録すると、以下のリポジトリのコードから無料LLMたちを楽しむことができます。

[github.com/mu7889yoon/free-llm-comparsison](https://github.com/mu7889yoon/examples/tree/main/free-llm-comparison)

呼び出せることはわかっているので、おそらく皆さんが気になっている

- Cloudflareの10,000 neuronってどれぐらい？
- IO.netの上限ってどれぐらい

について検証します。

### Cloudflareの10,000 neuronってどれぐらい？

![](/images/019d57f0-d5d6-76c2-81b9-af6e25e152c4.png)

[JSQuAD](https://github.com/yahoojapan/JGLUE/blob/main/datasets/jsquad-v1.3/train-v1.3.json)のデータを使って検証します。

![](/images/019d57f0-4936-72ae-8762-d290e305d01a.png)

Input 298 Token, Output 47 Tokenで12.69 neuronとなりました。

適当なプロンプトも使ってInput/OutputでNeuronをどれぐらい消費するのか計測します。

![](/images/019d57f0-3a3e-75c7-95fa-b53ca1bf7260.png)

Input 70 Token, Output 93 Tokenで8.57 neuronとなりました。

以上から大体こんな感じになりますね、(多分complexity計算してるので、これに限りません)

31.8 Input Token = 1 neuron

14.1 Output Token = 1 neuron




### IO.netの上限はどれぐらい？

同じく、JSQuADのデータを使って検証します。

![](/images/019d57f1-1434-7381-a599-b6df1ec86daa.png)

ていうか、どこから見れるんだ...

かなり使い込みましたが、レスポンスにエラーなど発生せず...

後から請求が来ても怖いので、ここら辺でやめておきます。。。

> めっちゃ請求来たらまた報告します。

![](/images/019d57f1-25ea-7d9e-bcbd-ac2b40c672df.png)

## まとめ

これだけ無料で使えるなら、正直有料のLLM APIを使う場面はかなり限られるかもしれません。

gpt-oss-120bを例にすると、さくらのAIで1日100回、Cloudflareで1日約100リクエスト以上、OpenRouterで1日50リクエスト、IO.netは上限が測定不能でした。

Gemini・Gemma系に至っては1日1,000回以上呼び出せるので、個人利用で使い尽くせる気がしません。

ただし、無料サービスなので個人情報や機密データは入れないようにしましょう。あくまで気軽に試す用途で。

AWSもNova系に無料枠を設けてくれると嬉しいな〜とか思っていたり。

ではでは〜
