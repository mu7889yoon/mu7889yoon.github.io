---
date: '2026-09-24T13:00:00+09:00'
draft: false
tags: ['tech', 'aws', 'ecs', 'fargate', 'discord']
description: 'Discord Gatewayへ常時接続するBotを、ALBなしのECS Fargate Spotで動かす構成と、LightsailやLambda MicroVMsとの使い分けを整理します。'
title: 'Discord Gatewayに常時接続するBotを、Fargate Spotで安く動かす'
---

よ〜んです。

以前、[ALBなしでECSを使う構成](https://mu7889yoon.github.io/posts/alb-less-ecs/)を紹介しました。今回はその考え方を、Discord Gatewayへ常時接続するBotに当てはめます。

Discord BotをAWSで動かすとき、一番安い選択肢はおそらくLightsailです。次に、少し使い方に工夫がいるLambda MicroVMs。EC2という選択肢もあります。

そしてECS。コンテナを動かすサービスとしては便利ですが、普通に構成すると周辺リソースが増えて、Botを1つ動かすだけのスコープではオーバースペックになりがちです。

今回は、Discord Gatewayへ常時接続するBotを題材に、ECSをALBなしで小さく動かす構成をご紹介します。

## Gateway Bot

Discord Botには、HTTPで受け取ったInteractionに応答するものや、Gatewayへ接続してイベントを受け取るものがあります。

今回扱うのは後者です。Botのプロセスが起動している間、Discord Gatewayへ接続し続けます。

つまり、短い処理を実行して終了するLambda関数のような使い方とは相性がよくありません。常時接続が必要なら、プロセスが動き続ける実行環境を用意する必要があります。

## Lightsail

安い。IPv6専用なら月額3.50 USD、IPv4付きなら5 USDからです（[料金表](https://aws.amazon.com/lightsail/pricing/)）。

Dockerで常時稼働できますが、更新はSSHや自前のCI/CDで行います。

## Lambda MicroVMs

使うときだけ起動でき、実行時間を抑えられます。

ただし、最大8時間で、停止中はGatewayのイベントを受け取れません（[公式ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/microvms-launching.html)）。

常時反応するBotには不向きで、起動用の別経路も必要です。

## EC2

自由度が高く、Botを常時稼働できます。

その分、OS・実行環境・デプロイは自分で管理します。

Lightsailより費用が上がりやすいため、今回は候補から外します。

## ECS Fargate Spot

コンテナのデプロイを自動化しつつ、Botを常時稼働できます。

受信HTTPがないのでALBは不要。Public SubnetからPublic IPでGatewayへ接続します（[通信経路](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/networking-outbound.html)）。

NAT Gatewayも置かず、Security Groupはインバウンドなし・外向きTCP 443のみです。

### GravitonとFargate Spotを使う

タスクはARM64で動かします。Fargate Spotは、通常のFargate料金より割引された料金でタスクを実行できる仕組みです。ECSではARM64とFARGATE_SPOTを組み合わせられます。

今回のタスク定義は0.25 vCPU、メモリ512 MiB、desired countは1です。Botの処理量に対して大きすぎないサイズから始めています。

ただし、Fargate Spotは中断される可能性があります。AWSが容量を回収するときは、タスク停止の2分前に通知されます。ECS Serviceが代わりのタスクを起動しますが、その間はBotが一時的に切断される可能性があります。Spotの特性と通知については[公式ドキュメント](https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/fargate-capacity-providers.html)を確認してください。

Botが切断から再接続できること、短い停止を許容できることが前提です。可用性が重要なBotなら、Spotだけでよいかは別途考える必要があります。

### ECSでも、最安とは限らない

ここは誤解しやすいところです。

「ALBなし」「Graviton」「Fargate Spot」にすると、ECS構成の料金は抑えられます。ただし、これはLightsailの月額3.50 USDより必ず安い、という意味ではありません。ECSではFargateの実行料金に加えて、Public IPv4、CloudWatch Logs、ECR、Secrets Managerなどの利用料も発生しえます。タスクを24時間動かすか、リージョンやログ量がどれくらいかでも変わります。

なので、Lightsailより絶対に安いものを探しているなら、まずはLightsailを選ぶのが筋です。今回のECS構成は、コンテナで開発・デプロイしやすくしながら、ALBやNAT Gatewayといった構成上不要なコストを避けたい人向けです。料金の最終確認には[AWS Fargateの料金ページ](https://aws.amazon.com/jp/fargate/pricing/)やAWS Pricing Calculatorを使ってください。

## 今回の構成

個人のHome Systemでは、Node.jsのDiscord BotをECS Fargate Spot Serviceとして起動しています。

GitHub ActionsでコンテナイメージをECRへpushし、ECS Serviceへデプロイします。ServiceはARM64、0.25 vCPU、メモリ512 MiBのFargate Spotタスクを1つ起動します。Bot TokenはSecrets Managerから渡し、ログはCloudWatch Logsへ送ります。

```mermaid
architecture-beta
    group aws(logos:aws)[AWS ap-northeast-1]

    service actions(logos:github)[GitHub Actions]
    service ecr(logos:aws-s3)[ECR] in aws
    service ecs(logos:aws-ecs)[ECS Service] in aws
    service task(logos:aws-ecs)[Fargate Spot Task] in aws
    service secret(logos:aws-secrets-manager)[Secrets Manager] in aws
    service logs(logos:aws-cloudwatch)[CloudWatch Logs] in aws
    service igw(internet)[Public Subnet + IGW] in aws
    service discord(internet)[Discord Gateway]

    actions:R --> L:ecr
    actions:B --> T:ecs
    ecr:R --> L:task
    ecs:R --> L:task
    secret:B --> T:task
    task:R --> L:logs
    task:B --> T:igw
    igw:B --> T:discord
```

## まとめ

今回の構成を作ってみてわかったのは、ECS自体がBotにとって必ずしもオーバースペックというわけではないことです。Webアプリ向けの構成をそのまま持ち込むと大きくなりますが、Botに必要な実行環境とデプロイの仕組みだけに絞れば、ECSでも小さく始められます。実行料金だけでなく、コードを更新するたびの手間も含めて考えると、自分にとって何が「安い」のかは変わるんだなと思いました。

お得に生きていきましょう。よ〜んでした。
