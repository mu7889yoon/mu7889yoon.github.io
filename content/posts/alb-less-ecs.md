---
date: '2026-01-04T20:55:32+09:00'
draft: false
tags: ['tech', 'aws', 'ecs', 'fargate', 'apigateway', 'cloudmap', 'cdk']
description: 'ALBの固定費を避けて、API Gateway HTTP API + VPC Link + AWS Cloud Map でECS(Fargate)をなんちゃってLBする構成をCDKで作る。'
title: 'ECSをALBなしでお得に使いたいやん？'
---

よ〜んです。

個人的に、AWS上で何かを動かすときは、

1. Step Functions で実現可能？
2. Lambda
3. ECS（Fargate）

大体こんな感じの思想で選んでいます。

で、とりあえずECSを選択すると立ちはだかるのがALB、ALBは時間課金＋通信料がかかります。

個人的な用途なのに、毎月15 USD以上の固定費は正直つらい......

タスクを使う時だけ起動にしても、ALBは起動しっぱなしなので、節約の恩恵がめちゃくちゃ薄いです。

ということで、今回は API Gateway HTTP API をロードバランサーっぽく使ってECSを動かしてみます。

やりたいことはざっくり以下です。

- API Gateway → VPC Link → Cloud Map（Service Discovery） → ECS（Fargate）

この構成自体は、2020年にAWSアーキテクチャブログで公開された記事をベースに構築していきます。

[Field Notes: Integrating HTTP APIs with AWS Cloud Map and Amazon ECS services](https://aws.amazon.com/jp/blogs/architecture/field-notes-integrating-http-apis-with-aws-cloud-map-and-amazon-ecs-services/)

### AWS Cloud Map とは

AWS Cloud Map はリソースを検出するサービスです。

ECSのタスクは起動のたびにIPアドレスが変わったりしますが、Cloud Map を使うことで、`backend.ecs.local` みたいな名前でECSのタスクのIPアドレスを引くことが可能になります。

## 構築&デプロイ

CDKで管理します。

コードは[こちら](https://github.com/mu7889yoon/examples/tree/main/alb-less-ecs)にございます。

### 動作チェック

API Gatewayのエンドポイントにアクセスしてみます。

![](/images/019b891f-e271-7e33-b8d8-081367eeeedb.png)

アクセスできました。後々の検証のため、レスポンスでIPアドレスを表示させています。

タスク数を2つにしてみます。

![](/images/019b891f-e271-735f-81c0-e1ae56e533c5.png)

IPアドレスが異なっています、ロードバランシングされていることがわかります。

マネコンからCloud Mapを見ると、サービス（`backend`）にタスクが登録されていました。

![](/images/019b891f-e271-7ec3-ab15-f6a04a3e8a23.png)

### コスト

大阪リージョンでの概算です。

| Service | Cost per month |
| - | - |
| Fargate (0.25 vCPU, 0.5 GB) | 11.25 USD |
| Application Load Balancer | 17.75 USD |
| ECR | 1.08 USD |
| **Total** | **30.08 USD** |

これが、ALBからAPI Gateway + Cloud Mapの構成に移行することで...

| Service | Cost per month |
| - | - |
| Fargate (0.25 vCPU, 0.5 GB) | 11.25 USD |
| ECR | 1.08 USD |
| API Gateway | ≒ 0 USD |
| Cloud Map | ≒ 0 USD |
| Route 53 Private Hosted Zone | 0.50 USD |
| **Total** | **12.83 USD** |

こうなります、さらに追加でGraviton(Arm)にすると、もっと安くなります。

| Service | Cost per month |
| - | - |
| Fargate (0.25 vCPU, 0.5 GB, Arm) | 8.99 USD |
| ECR  | 1.08 USD |
| API Gateway | ≒ 0 USD |
| Cloud Map | ≒ 0 USD |
| Route 53 Private Hosted Zone | 0.50 USD |
| **Total** | **10.57 USD** |

コストを従来の構成の1/3まで減らすことができで大満足です。

今までも使う時だけタスク起動はやっていましたが、ALBは常時起動なので固定費が残り続けて、節約の恩恵が薄かったんですよね。

この構成だと、その固定費を削げるのでコストをかなり抑えることができました。

私は🉐🉐ケチケチ星人なので、さらに **Fargate Spot + 使う時間帯だけ起動** で運用しています。

## まとめ

開発環境や個人で使用する環境であればこれで十分ではないでしょうか

「ECS使いたいけど、ALBのコストが気になる」みたいなときの選択肢として、頭の片隅に置いていただけると嬉しいです。

それではみなさん🉐して良いコンテナライフを
