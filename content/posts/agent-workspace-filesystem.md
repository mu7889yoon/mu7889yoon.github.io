---
date: '2026-09-30T18:39:02+09:00'
draft: false
tags: ['tech', 'aws', 'tidb']
description: 'Lambda MicroVMsからTiDB Cloud FilesystemをVPCなしでマウントした検証をきっかけに、エージェントの作業場所にファイルシステムが必要か考えました。'
title: 'エージェントの作業場所にファイルシステムは必要か'
---

よ〜んです。

ServerlessDays 2026に登壇＆参加してました、2日目はTiDBさんのワークショップに参加しました。

そこで触れたのが、新しいサービスのTiDB Cloud Filesystemです。ワークショップの内容は[TiDB Cloud Filesystemのハンズオン](https://labs.tidb.io/ja/labs/demo_901)として公開されています。

説明を聞きながら、ふと思いました。

これ、VPCなしでLambda MicroVMsからマウントできるんじゃね？

と言うことで、試してみることにしました。

## FUSE

FUSEは「Filesystem in Userspace」の略です。

ユーザー空間のプログラムがファイルシステムを実装し、Linuxからは通常のファイルパスとして扱えるようにする仕組みです。

TiDB Cloud FilesystemをLinuxでマウントする場合も、FUSEを使います。FUSE自体は保存先ではなく、ファイルシステムをOSに接続する仕組みです。

[1. FUSE Overview — The Linux Kernel documentation](https://docs.kernel.org/filesystems/fuse/fuse.html)

[TiDB Cloud CLI のリージョン、セキュリティ、および制限事項 | TiDB Docs](https://docs.pingcap.com/ja/ai/ti-regions-security-and-limitations/)

## Drive9

Drive9のプロジェクトは、エージェントの作業状態をサンドボックスをまたいで引き継ぐワークスペースを提供しています。

[mem9-ai/drive9](https://github.com/mem9-ai/drive9)

## VPCなしでLambdaやLambda MicroVMsからマウントできるか検証

Dockerコンテナ内でマウントするためのTiDB公式手順には、FUSEのインストールに加えて、次の設定が載っています。

- `/dev/fuse`を`--device /dev/fuse`でコンテナに渡す
- `CAP_SYS_ADMIN`を`--cap-add SYS_ADMIN`で追加する
- `--security-opt apparmor=unconfined`でAppArmorによる制限を外す

[Mount a File System in Docker | TiDB Docs](https://docs.pingcap.com/tidbcloud-filesystem/filesystem-mount-docker/)

AWS Lambdaのファイルシステム機能は、EFSまたはS3 Filesをマウントする仕組みです。

今回必要な`/dev/fuse`やLinux capabilityを渡す構成とは違うため、Lambdaからのマウントは不可能でした(残念)

[Configuring file system access for Lambda functions - AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-filesystem.html)

と言うことでMicroVMsを試します。

VPCは作らず、インターネットコネクタもデフォルトのものを使います。

結果、マウントできました。今回の構成では特に引っかかることもなく、VPCなし・デフォルトのインターネットコネクタでTiDB Cloud Filesystemを使えました。

![](/images/01a0f1c5-cbf8-7444-aa19-1a503ee7ea02.jpeg)

## エージェントの作業場所

Serverless Days 1日目のセッションでは、エージェントがクラウド上のサンドボックスで作業してるのは前提として、そうなると問題となってくるのが、作業中のファイル・成果物をどこに置くかです。

エージェントが単独で作業し、人間が後から成果を確認するだけなら、S3 SyncやGitHubへのpushで足りるかもしれません。作業中のファイルをリアルタイムに見たい場面は、私はあまり思いつきませんでした。

## ファイル共有とロック

一方、人間とエージェントが同じファイルを同時に扱うなら、共有やファイルロックが意味を持ちそうです。たとえば、誰かが編集中のファイルを別の人が同時に更新しないようにする、といった場面です。

TiDB Cloud Filesystemでロックがどう動くかは、今回確認してないのですが、私なりに考えた使い分けはこんな感じです。

- エージェントが単独で作業し、後から成果を受け取る
  - S3
  - Git
- 人間とエージェントが同じファイルを同時に扱う可能性がある
  - ファイルシステム

もちろん、どのケースでもこの選択になるという話ではありません。

## まとめ

Lambda MicroVMsからTiDB Cloud FilesystemをVPCなしでマウントできました。ただ、検証を通じて考えたのは、エージェントの作業場所にファイルシステムが必要なのかということでした。

エージェントが単独で作業するならS3やGitHubで足りるかもしれません。人間と一緒に同じファイルを扱うなら、共有やロックのためにファイルシステムが役立つ場面もありそうです。

では〜ん
