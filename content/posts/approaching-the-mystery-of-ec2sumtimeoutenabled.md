+++
date = '2026-01-23T20:47:02+09:00'
draft = false
tags = ['tips', 'tech', 'aws','cdk' ]
description = 'AWS CDKのバージョン履歴を人力で調査し、`ec2SumTImeoutEnabled`がいつから`ec2SumTImeoutEnabled`なのかを調査します。'
title = 'ec2SumTImeoutEnabledの謎に迫る'
+++
よ〜んです。

> 本記事の内容は、[JAWS-UG大阪2025 忘年勉強会 FSF](https://jawsugosaka.connpass.com/event/374553/)で発表した[AWSあるある](https://speakerdeck.com/mu7889yoon/jaws-ugda-ban-wang-nian-mian-qiang-hui-fsf-awsaruaru)にて10個発表したうちの8個目について掘り下げていきます。

現在(2026/01/23)、aws-cdkには、642個のバージョンがあります。

![](/images/019beadd-122d-7d66-9aaa-cc01a9855e3c.png)

[aws-cdk - npm](https://www.npmjs.com/package/aws-cdk/v/0.8.0?activeTab=versions)

## 今回やること

いつ頃`ec2SumTImeoutEnabled`が`cdk.json`に出力されるようになったのかを調査し、`TImeout(Iが大文字)`になったバージョンなどを調査しようと思います。

何もなければ、何もないで納得します。

## 調査開始

642バージョン全てで`cdk init`するのも可能ですが、今回は人力で二分探索します。

まずは、npmで確認できる最古のバージョン 0.8.0から

### 0.8.0 - 1回目の試行

```sh
npx aws-cdk@0.8.0 init -l ts


Need to install the following packages:
aws-cdk@0.8.0
Ok to proceed? (y) 

不正な値です:
  引数は language です。指定できるのは "ts" つです。選択してください: "java", "typescript"



npx aws-cdk@0.8.0 init -l typescript


# Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
```

では、`cdk.json`を見てみましょう

#### cdk.json

```json
{
    "app": "node bin/v0.8.0.js"
}
```

これだけでした、非常にシンプルです。

`ec2SumTImeoutEnabled`が存在していることはわかっていますが、現在の最新のバージョンの出力を確認します。

### 2.1102.0 - 2回目の試行

```sh
npx aws-cdk@2.1102.0 init -l ts
```

#### cdk.json

```json
    "@aws-cdk/aws-ecs:reduceEc2FargateCloudWatchPermissions": true,
    "@aws-cdk/aws-dynamodb:resourcePolicyPerReplica": true,
    "@aws-cdk/aws-ec2:ec2SumTImeoutEnabled": true,
    "@aws-cdk/aws-appsync:appSyncGraphQLAPIScopeLambdaPermission": true,
    "@aws-cdk/aws-rds:setCorrectValueForDatabaseInstanceReadReplicaInstanceResourceId": true,
```

もちろんありました。

では、320番目のバージョンを見てみます。

### 2.0.0-rc.21 - 3回目の試行

```sh
npx aws-cdk@2.0.0-rc.21 init -l typescript
```

#### cdk.json

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/v2.0.0-rc.21.ts",
  "context": {
    "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
    "@aws-cdk/core:stackRelativeExports": "true",
    "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
    "@aws-cdk/aws-lambda:recognizeVersionProps": true,
    "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021": true
  }
}
```

`ec2SumTImeoutEnabled`はありませんが、`context`に設定されている値がまだまだ少ないですね

では480番目のやつを見ます。

### 2.108.0 - 4回目の試行

```sh
npx aws-cdk@2.108.0 init -l typescript
```

#### cdk.json

`ec2SumTImeoutEnabled`はありませんでしたが、`context`で設定されている値は結構増えました。

では、560番目を見てみます

### 2.167.0 - 5回目の試行

```sh
npx aws-cdk@2.167.0 init -l typescript
```

#### cdk.json

```json
    "@aws-cdk/aws-ecs:reduceEc2FargateCloudWatchPermissions": true,
    "@aws-cdk/aws-dynamodb:resourcePolicyPerReplica": true,
    "@aws-cdk/aws-ec2:ec2SumTImeoutEnabled": true,
    "@aws-cdk/aws-appsync:appSyncGraphQLAPIScopeLambdaPermission": true,
    "@aws-cdk/aws-rds:setCorrectValueForDatabaseInstanceReadReplicaInstanceResourceId": true,
```

`ec2SumTImeoutEnabled`がありました！次は少し戻って520番目を確認してみます！

### 2.140.0 -　 6回目の試行

```sh
npx aws-cdk@2.140.0 init -l typescript
```

### cdk.json

`ec2SumTImeoutEnabled`はありませんでした、次は中間地点の540番目を確認します。

### 2.153.0 -　7回目の試行

```sh
npx aws-cdk@2.153.0 init -l typescript
```

#### cdk.json

`ec2SumTImeoutEnabled`はありませんでした。次は550番目を見ます。

### 2.161.0 - 8回目の試行

```sh
npx aws-cdk@2.161.0 init -l typescript
```

#### cdk.json

```json
    "@aws-cdk/aws-s3:keepNotificationInImportedBucket": false,
    "@aws-cdk/aws-ecs:reduceEc2FargateCloudWatchPermissions": true,
    "@aws-cdk/aws-ec2:ec2SumTImeoutEnabled": true,
    "@aws-cdk/aws-appsync:appSyncGraphQLAPIScopeLambdaPermission": true,
    "@aws-cdk/aws-rds:setCorrectValueForDatabaseInstanceReadReplicaInstanceResourceId": true,
```

`ec2SumTImeoutEnabled`がいました！545番目を見ます。

### 2.157.0 - 9回目の試行

```sh
npx aws-cdk@2.157.0 init -l typescript
```

#### cdk.json

`ec2SumTImeoutEnabled`は無かったですが、かなり絞られてきました。547番目を見ます。

### 2.159.0 - 10回目の試行

```sh
npx aws-cdk@2.159.0 init -l typescript 
```

#### cdk.json

`ec2SumTImeoutEnabled`はありません。548番目を見ます。

### 2.159.1 - 11回目の試行

```sh
npx aws-cdk@2.159.1 init -l typescript
```

#### cdk.json

`ec2SumTImeoutEnabled`ありません。549番目にいきます。

### 2.160.0 - 12回目の試行

```sh
npx aws-cdk@2.160.0 init -l typescript
```

#### cdk.json

```json
    "@aws-cdk/aws-s3:keepNotificationInImportedBucket": false,
    "@aws-cdk/aws-ecs:reduceEc2FargateCloudWatchPermissions": true,
    "@aws-cdk/aws-ec2:ec2SumTImeoutEnabled": true
  }
}
```

`ec2SumTImeoutEnabled`がありました！バージョン 2.160.0から追加されたようです。

では、[2.160.0のリリース](https://github.com/aws/aws-cdk/releases/tag/v2.160.0
)を見てみます。

> ec2: instance resourceSignalTimeout overwrites initOptions.timeout ([#31446](https://github.com/aws/aws-cdk/issues/31446)) ([a29bf19](https://github.com/aws/aws-cdk/commit/a29bf19be1e17c13b85f6edd45c382c1f0d89702)), closes [#30052](https://github.com/aws/aws-cdk/issues/30052)

Bug Fixesのところに記載がありますね。

### まとめ(？)

どこかのタイミングで`cdk.json`の`ec2SumTimeoutEnabled`が`ec2SumTImeoutEnabled`になるのかと思っていましたが、最初から`ec2SumTImeoutEnabled`だったようです。

意図したものなのでしょうかね...これ以上の深掘りはできないので、ここら辺で切り上げようと思います。

ここまで読んでいただき、ありがとうございました。
