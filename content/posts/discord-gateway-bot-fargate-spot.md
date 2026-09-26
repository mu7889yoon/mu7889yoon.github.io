---
date: '2026-09-24T13:00:00+09:00'
draft: false
tags: ['tech', 'aws', 'ecs', 'fargate', 'discord']
description: 'Discord Gatewayへ常時接続するBotを、ALBなしのECS Fargate Spotで動かす構成と、LightsailやLambda MicroVMsとの使い分けを整理します。'
title: 'Discord Gatewayに常時接続するBotを、Fargate Spotで安く動かす'
---

よ〜んです。

Discord BotをAWSで動かすとき、一番安い選択肢はおそらくLightsailです。次に、少し使い方に工夫がいるLambda MicroVMs。EC2という選択肢もあります。

そしてECS。コンテナを動かすサービスとしては便利ですが、普通に構成すると周辺リソースが増えて、Botを1つ動かすだけのスコープではオーバースペックになりがちです。

今回は、Discord Gatewayへ常時接続するBotを題材に、ECSをALBなしで小さく動かす構成をご紹介します。

## Discord Botは「常時接続」が必要なタイプもある

Discord Botには、HTTPで受け取ったInteractionに応答するものや、Gatewayへ接続してイベントを受け取るものがあります。

今回扱うのは後者です。Botのプロセスが起動している間、Discord Gatewayへ接続し続けます。

つまり、短い処理を実行して終了するLambda関数のような使い方とは相性がよくありません。常時接続が必要なら、プロセスが動き続ける実行環境を用意する必要があります。

## 選択肢1: Lightsail

最も安く、手軽にサーバーを置くならLightsailが有力です。

記事執筆時点で、IPv6専用のLinuxインスタンスは月額3.50 USDからあります。IPv4も必要なプランは月額5 USDからです。料金はプランやリージョンで変わるので、使う前に[公式料金表](https://aws.amazon.com/lightsail/pricing/)を確認してください。

インスタンスを1台立ち上げてDockerを動かせば、Botを常時接続できます。実行環境の単純さと料金だけを優先するなら、まず検討したい選択肢です。

一方で、コンテナを更新するたびにデプロイ手順を用意する必要があります。SSHで入って更新するか、デプロイ用のシェルやCI/CDを整えることになります。Botの機能を頻繁に追加するなら、この運用がだんだん面倒になってくるかもしれません。

## 選択肢2: Lambda MicroVMs

「必要なときだけBotを起動したい」なら、Lambda MicroVMsも候補になります。

MicroVMは最大8時間まで実行またはサスペンド状態を維持できます。使いたい時間だけ起動し、使い終わったら止める形なら、24時間動かし続けるより実行時間を抑えられます。詳しくは[AWSのMicroVMドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/microvms-launching.html)を参照してください。

ただし、Botが停止している間は、そのBot自身がDiscord Gatewayからイベントを受け取ることはできません。Discordから起動指示を受けたい場合は、別の常時稼働プロセスやInteraction用のエンドポイントなど、起動のための入口を別に用意する必要があります。

「いつでもBotが反応してほしい」という用途では、その起動導線をどう作るかが設計ポイントになります。

## 選択肢3: EC2

EC2にBotを置いて常時起動する方法もあります。インスタンスを選ぶ自由度は高いですが、OSの更新、Dockerの実行環境、デプロイの仕組みなどを自分で管理します。

Lightsailと同じく、SSHでインスタンスへ入って更新する運用にもできますし、CI/CDを組んでデプロイを自動化することもできます。今回は「コンテナのデプロイは自動化したい。でもBotのために大きな構成は持ちたくない」という観点から、ECSを見ていきます。

## 選択肢4: ECS Fargate SpotをALBなしで使う

今回採用したのが、ECS Fargate SpotでBotを常時稼働させる構成です。

ここでのポイントは、BotがDiscord Gatewayへ接続しに行くだけで、外部からBotへHTTPリクエストを受け付けないことです。受信トラフィックを振り分ける必要がないので、ALBを置かずに済みます。

タスクをPublic Subnetで起動し、Public IPからインターネットへ出てDiscord Gatewayへ接続します。今回の設定では、Security Groupのインバウンドルールは空で、外向きのTCP 443だけを許可しています。Fargateタスクからインターネットへ出る方法は[公式ドキュメント](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/networking-outbound.html)にも説明があります。

ALBは不要ですし、Private Subnetから外に出るためだけのNAT Gatewayも置きません。常時接続Botの通信経路を単純にして、周辺の固定費を避ける構成です。

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
    group github(logos:github)[GitHub]
    group aws(logos:aws)[AWS ap-northeast-1]
    group vpc(logos:aws-ec2)[VPC] in aws
    group public(cloud)[Public Subnet] in vpc

    service actions(logos:github)[GitHub Actions] in github
    service ecr(server)[Amazon ECR] in aws
    service ecs(logos:aws-ecs)[ECS Service] in public
    service task(logos:aws-fargate)[Fargate Spot Task] in public
    service sg(logos:aws-ec2)[Security Group] in public
    service igw(internet)[Internet Gateway] in vpc
    service secret(logos:aws-secrets-manager)[Secrets Manager] in aws
    service logs(logos:aws-cloudwatch)[CloudWatch Logs] in aws
    service discord(internet)[Discord Gateway]

    actions:R --> L:ecr
    actions:B --> T:ecs
    ecr:R --> L:task
    ecs:B --> T:task
    sg:R -- L:task
    secret:R --> L:task
    task:B --> T:igw
    task:R --> L:logs
    igw:R --> L:discord
```

構成や実装は[home-systemのDiscord Bot](https://github.com/mu7889yoon/home-system/tree/main/discord-bot)と[Terraform設定](https://github.com/mu7889yoon/home-system/tree/main/infrastructure/discord-bot)に置いています。現状は個人プロジェクトの一部として管理しているコードです。

## まとめ

今回の構成を作ってみてわかったのは、ECS自体がBotにとって必ずしもオーバースペックというわけではないことです。Webアプリ向けの構成をそのまま持ち込むと大きくなりますが、Botに必要な実行環境とデプロイの仕組みだけに絞れば、ECSでも小さく始められます。実行料金だけでなく、コードを更新するたびの手間も含めて考えると、自分にとって何が「安い」のかは変わるんだなと思いました。

お得に生きていきましょう。よ〜んでした。
