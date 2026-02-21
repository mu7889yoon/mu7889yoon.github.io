---
date: '2025-12-13T00:00:00+09:00'
draft: false
tags: ['tech', 'tips', 'aws', 'step-functions']
description: 'Step Functionsはタスク毎にIAMのセッションが変わるため、AWS APIによってはうまく動かないことがあります。解決方法は思い浮かびませんが、調査結果をシェアします。'
title: 'Step Functionsはタスク毎にIAMのセッションが変わる'
---

よ〜んです。

> 2022年にほぼ同じ内容の記事が公開されておりましたが、2025年も変わらないよ。と言う意味で記事化させていただきます。
> [AWS Step Functions ステートマシンで実行されるタスクはそれぞれセッションプリンシパルが異なる](https://dev.classmethod.jp/articles/aws-step-functions-statemachine-task-assumerole/)

AWSのサービス一覧を取得する方法として、以下のような手法があります。

```bash
JOB_ID=$(aws iam generate-service-last-accessed-details --arn arn:aws:iam::aws:policy/AdministratorAccess --output text)
aws iam get-service-last-accessed-details --job-id $JOB_ID

// output
{
    "JobStatus": "COMPLETED",
    "JobType": "SERVICE_LEVEL",
    "JobCreationDate": "2025-12-13T00:00:00.000000+09:00",
    "ServicesLastAccessed": [
        {
            "ServiceName": "AWS App2Container",
            "ServiceNamespace": "a2c",
            "TotalAuthenticatedEntities": 0
        },
        {
            "ServiceName": "Alexa for Business",
            "ServiceNamespace": "a4b",
            "TotalAuthenticatedEntities": 0
        },
```

これらはAWS APIを組み合わせたものですので、Step Functionsで実行可能ではないか？と思い、以下のようなState Machineを組んでみたところ、意図した動作をせず、ハマりまくったため、調査したことを記録します。

## 調べてみたこと

以降、`GenerateServiceLastAccessedDetails`は`GenereteService`、`GetServiceLastAccessedDetails`は`GetService`とさせていただきます。

### エラー内容

### CloudShellで生成したJobIdを使ってStep FunctionsでGetService　してみる

### Step Functionsで生成したJobIdを使ってCloudShellでGetServiceしてみる

### API Documentを読む

### CloudTrailを見る

## まとめ

Step Functionsの仕様を知りつつ、`GenerateServiceLastAccessedDetails`のハマりどころって感じでした。

`JobId`が帰ってくるAPIはもしかしたら本件となるかもしれません。

## 追記

ほぼ同じ内容の記事がありました。ググり不足ですね...

[AWS Step Functions ステートマシンで実行されるタスクはそれぞれセッションプリンシパルが異なる](https://dev.classmethod.jp/articles/aws-step-functions-statemachine-task-assumerole/)
