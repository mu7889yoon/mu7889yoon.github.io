---
date: '2026-10-03T01:42:32+09:00'
draft: false
tags: ['tech', 'aws', 'cdk', 'cdkd', 'ecs']
description: '前回作ったSpring BootのTodoアプリを、AWS CDKのL3 Constructで構成し、cdkdからFargateへデプロイしてみました。'
title: 'L3 Constructをcdkdでデプロイしてみる'
---

よ〜んです。

[前回の記事](https://mu7889yoon.github.io/posts/getting-start-with-spring-boot/)では、Spring BootでシンプルなTodoアプリを作りました。

今回は、そのアプリを動かすインフラをAWS CDKで書いて、[cdkd](https://github.com/go-to-k/cdkd)からデプロイしてみます。

気になっていたのは、L3 Constructすらもそのまま使えるのか、というところです。

## cdkd

cdkdはCDK Directの略で、AWS CDKのアプリケーションを、CloudFormationのスタック経由ではなくAWS SDKやCloud Control APIを使ってデプロイするツールです。

CDKのコードからCloudFormationテンプレートを生成し、それをもとにcdkdがリソースを作成・更新します。インフラを書くのはCDK、デプロイを担当するのはcdkd、という分担ですね。

[cdkd - README](https://github.com/go-to-k/cdkd/blob/v0.294.0/README.md)

## 前回のアプリをAWSへ

[ちょっと前の記事](/posts/getting-start-with-spring-boot/)で作ったTodoアプリを、ALB付きのECS Fargateで動かし、Aurora PostgreSQL Serverless v2に接続する構成をCDKで書きました。

コードは[examplesリポジトリ](https://github.com/mu7889yoon/examples/tree/main/getting-started-with-spring-boot-and-cdkd)に置いてあります。

## ApplicationLoadBalancedFargateService(L3 Construct)について

L3 Constructは、複数のリソースをよく使う構成としてまとめたものです。今回なら、ECSサービスやALBなどを一つのConstructから定義できます。

[実際のコード](https://github.com/mu7889yoon/examples/blob/main/getting-started-with-spring-boot-and-cdkd/infra/lib/todo-stack.ts)から、設定の一部を抜粋するとこんな感じです。

```typescript
const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
  cluster,
  publicLoadBalancer: true,
  listenerPort: 80,
  assignPublicIp: true,
  cpu: 256,
  memoryLimitMiB: 512,
  // その他の設定は省略
});
```

ここは普段のCDKの書き方です。今回使ったFargateのL3 Constructは、cdkd専用の定義へ書き直すことなく利用できました！！！

できるだろうな〜と思いつつ検証しましたが、すごいの一言です。。。

## デプロイしてみる

デプロイ時には`--full-wait`を付けました。cdkdはデフォルトではECSサービスの安定状態まで待ちませんが、このオプションを付けるとそこまで待つようになります。

参考：[Wait Modes](https://github.com/go-to-k/cdkd/blob/v0.294.0/docs/wait-modes.md)

デプロイ後にアクセスすると、前回作ったTodo画面が確認できました。

## まとめ(？)

今回試したかったのは、L3 Constructも普通に使えるのかというところです。

速度比較はしていませんが、L3を使いながら、デプロイの仕組みを変えて素早くデプロイできた体験は素晴らしかったです。

ではでは〜
