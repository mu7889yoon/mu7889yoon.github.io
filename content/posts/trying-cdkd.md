---
date: '2026-10-03T01:42:32+09:00'
draft: true
tags: ['tech', 'aws', 'cdk', 'cdkd', 'ecs']
description: 'Spring BootのTodoアプリをcdkdでFargateへデプロイし、CDKの書き味、ECSの待機、途中停止後の復旧で感じたことを紹介します。'
title: 'cdkdを触ってみました'
---

よ〜んです。

[Spring BootでTodoアプリを作り](https://mu7889yoon.github.io/posts/getting-start-with-spring-boot/)、[PostmanでAPIを触ってみた](https://mu7889yoon.github.io/posts/getting-start-with-postman/)ので、今度はAWSにデプロイしてみます。

せっかくなので、普段のAWS CDK CLIではなく、[cdkd](https://github.com/go-to-k/cdkd)を使ってみました。

CDKのコードは見慣れたままなのに、デプロイを担当する仕組みが変わる。ここが面白いところです。

最終的にはFargate上でアプリが動きました。ただ、途中で止まったデプロイの復旧にはかなり手こずったので、そのあたりも残しておきます。

## cdkd

cdkdはCDK Directの略で、AWS CDKのアプリケーションをCloudFormationのスタック経由ではなく、AWS SDKやCloud Control APIを使ってデプロイするツールです。

CDKのコードからCloudFormationテンプレートを生成するところまでは同じ。そのテンプレートを受け取り、リソースを作成・更新する役をcdkdが担当します。

つまり、CDKのConstructを捨てて別の記法を覚える話ではありません。インフラの書き方と、デプロイの実行方式を分けて考えられるのが気になりました。

リソースの管理状態はS3に保存されます。CloudFormationのスタックで管理していた部分を、cdkd自身が持つということですね。

参考：[Core Concepts](https://github.com/go-to-k/cdkd/blob/v0.294.0/docs/concepts.md)

なお、今回使用したバージョンのREADMEでは、cdkdは開発・テスト用途で、まだ本番向けではないと明記されています。今回は学習用の環境として試しています。

参考：[cdkd v0.294.0 README](https://github.com/go-to-k/cdkd/blob/v0.294.0/README.md)

## 今回の構成

Spring BootのTodoアプリを、ALB付きのECS Fargateで動かし、Aurora PostgreSQL Serverless v2に接続します。リージョンは東京です。

最終的なFargateの設定は、0.25 vCPU、メモリ512 MiB、ARM64、1タスク。ALBからHTTPを受け、DBの接続情報はSecrets Managerから渡します。

最初はVPCとAuroraも含めた構成で進めましたが、復旧の過程で、作成済みのVPCとAuroraを再利用するアプリ側のスタックに分けました。この違いは、後でデプロイ時間を見るときにも関係します。

コードは[examplesリポジトリ](https://github.com/mu7889yoon/examples/tree/main/getting-started-with-spring-boot-and-cdkd)に置いてあります。

インフラ側の依存関係は、`aws-cdk-lib 2.272.0`、`cdkd 0.294.0`です。以下の体験は、この構成で試した範囲の話です。

## L3 Construct

ALB付きFargateには、`ApplicationLoadBalancedFargateService`を使いました。

L3 Constructは、複数のAWSリソースをよく使う構成としてまとめたものです。今回なら、ECSサービスやALBなどを一つのConstructから定義できます。

[実際のコード](https://github.com/mu7889yoon/examples/blob/main/getting-started-with-spring-boot-and-cdkd/infra/lib/todo-stack.ts)から、一部を抜粋するとこんな感じです。

```typescript
const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
  cluster,
  publicLoadBalancer: true,
  listenerPort: 80,
  assignPublicIp: true,
  taskSubnets: {
    subnetType: ec2.SubnetType.PUBLIC
  },
  cpu: 256,
  memoryLimitMiB: 512,
  runtimePlatform: {
    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    cpuArchitecture: ecs.CpuArchitecture.ARM64
  },
  // 以下、タスク数やコンテナイメージなどの設定
});
```

ここは普段のCDKです。cdkd専用のFargate定義へ書き直す必要がないのは、かなり入りやすいですね。

ただし、今回のコード全体が完全に無調整だったわけではありません。新規Auroraを作成する側には、RDSの一部プロパティを生成後のテンプレートから外す処理も入れています。

対象は`DBClusterParameterGroupName`、`CopyTagsToSnapshot`、`AutoMinorVersionUpgrade`、`PromotionTier`です。コード上では、cdkdの直接RDS Providerへの対応としてコメントを残しています。

これらを外すと、指定した値をそのまま適用する構成ではなくなります。「L3 Constructを使えた」と「CloudFormationで指定できるプロパティがすべて同じように適用される」は、分けて見る必要がありました。

## デプロイ

進め方は、`synth`でテンプレートを生成し、`diff`やdry-runで変更内容を見て、`deploy`する流れです。

今回のリポジトリでは、既存VPCやAuroraの情報を読み込むスクリプトを挟んで、npm scriptsから呼び出しています。

```bash
npm run synth
npm run diff
npm run deploy:dry-run
npm run deploy
```

このコマンド列は、既存リソースを再利用する最終構成のものです。初回のbootstrapや`.env.local`の準備、AWSプロファイルの設定は、[インフラのREADME](https://github.com/mu7889yoon/examples/blob/main/getting-started-with-spring-boot-and-cdkd/infra/README.md)にまとめています。

`npm run deploy`の中では、`TodoAppStack`に対して`cdkd deploy --full-wait`を実行しています。

### --full-wait

今回、気になったのは「デプロイ完了」の意味です。

cdkdはデフォルトでは、ECSサービスが安定状態になるまで待ちません。`--full-wait`を付けると、そこまで待つようになります。

参考：[Wait Modes](https://github.com/go-to-k/cdkd/blob/v0.294.0/docs/wait-modes.md)

今回はデプロイ後にアプリへアクセスしたかったので、`--full-wait`を使いました。コマンドが戻ってきた後、画面、ヘルスチェック、Todo APIでHTTP 200を確認できています。

もちろん、ECSが安定したことと、アプリのすべての機能が正しいことは別です。HTTPの確認は、デプロイとは別に行っています。

ここを揃えずにCLIの終了時間だけ比較すると、「アプリが使えるまでの時間」を比べたことにはならないですね。

## ハマったところ

### CPUアーキテクチャ

最初に詰まったのは、コンテナイメージのARM64と、Fargate側のCPUアーキテクチャ設定の食い違いでした。

これはcdkd固有の問題ではありません。イメージと実行環境の設定が合っていなかった、という構成上の問題です。

最終的なタスク定義では`runtimePlatform.cpuArchitecture`に`ARM64`を指定しています。デプロイツールを変えても、コンテナが動く条件は自分で揃える必要があります。

### 途中停止後の復旧

むしろ手こずったのはこちらでした。

デプロイを途中で止めた後、AWS上に残ったリソースとcdkd側の管理状態を揃えるのに苦労しました。その後の試行では、同名リソースとの衝突も起きています。

「直して、もう一回deployすればいい」だけでは進められない状態になっていました。

ただ、この経緯だけで「cdkdは途中停止すると必ず状態が壊れる」とは言えません。操作の順序や、どの段階で状態がずれたのかを、ログから切り分けられていないためです。

公式ドキュメントには、失敗時の自動ロールバックや、途中停止後に使う`cdkd rollback`も用意されています。ロールバック機能がないわけではありません。

参考：[Rollback behavior](https://github.com/go-to-k/cdkd/blob/v0.294.0/docs/rollback.md)

今回確かに言えるのは、私の試行では復旧に手間がかかった、というところまでです。

最終的には、作成済みのAuroraとVPCを参照する`TodoAppStack`を作り、アプリ側を別スタックとしてデプロイして動かしました。これは今回動かすために取った方法で、途中停止時の一般的な復旧手順として紹介するものではありません。

## 速かったのか

成功したデプロイについて、作業セッションの記録では15リソース、約4分43秒でした。

ただし、この時点ではAuroraとVPCを再利用しています。VPC・Auroraを含む環境一式を、その時間で新規作成できたという意味ではありません。また、ビルドやsynthをどこまで時間に含めたかも、比較用に整理できていません。

標準の`cdk deploy`で同じ構成を測っていないので、今回の数字だけで「cdkdの方が速かった」とは言えません。

公式のベンチマークはありますが、自分の構成での実測とは別です。速度を比較するなら、新規構築とアプリ更新を分け、ECSの安定やHTTP応答まで待つ条件も揃えて測りたいです。

参考：[公式ベンチマーク](https://cdkd.dev/benchmarks/)

## 感想

CDKの書き味を保ちながら、別のデプロイ方式を試せるのは面白かったです。

特にL3 Constructで書いたものが動くと、「CDKで書くこと」と「CloudFormationにデプロイしてもらうこと」は分けられるんだな、という手触りがあります。

一方で、デプロイ方式を変えると、待機の扱いや、失敗した後に見る管理状態も変わります。いつものCDKの感覚だけで進めると、今回のように復旧で詰まることもありました。

触ってみた感想としては、**デプロイの仕組みと状態管理を体験する学習材料として、かなり濃かった**です。

アプリが動いたところまでは進みましたが、旧スタックの一部リソースはセッション終了時点で残っています。片付けまで完了した検証ではないので、公開までに残存リソースと管理元を整理しておきます。

次に試すなら、まずその後片付け。その後、同じアプリの小さな更新を標準CDKとcdkdで比べてみたいですね。
