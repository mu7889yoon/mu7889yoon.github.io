---
date: '2026-09-26T20:39:00+09:00'
draft: true
tags: ['tech', 'aws', 'tidb']
description: 'Lambda MicroVMからTiDB Cloud FilesystemをVPCなしでマウントした検証をきっかけに、エージェントの作業場所にファイルシステムが必要か考えました。'
title: 'エージェントの作業場所にファイルシステムは必要か'
---

こんにちは、よ〜んです。

ServerlessDays 2026は、1日目がセッション、2日目がワークショップでした。2日目はAmazonさんとTiDBさんがワークショップを開いていて、私はTiDBさんの方に参加しました。

そこで触れたのが、新しいサービスのTiDB Cloud Filesystemです。ワークショップの内容は[TiDB Cloud Filesystemのハンズオン](https://labs.tidb.io/ja/labs/demo_901)として公開されています。

説明を聞きながら、ふと思いました。

> これ、VPCなしでLambda MicroVMからマウントできるんじゃね？

試してみることにしました。

## FUSE

FUSEは「Filesystem in Userspace」の略です。ユーザー空間のプログラムがファイルシステムを実装し、Linuxからは通常のファイルパスとして扱えるようにする仕組みです。TiDB Cloud FilesystemをLinuxでマウントする場合も、FUSEを使います。FUSE自体は保存先ではなく、ファイルシステムをOSに接続する仕組みです。([LinuxカーネルのFUSE解説](https://docs.kernel.org/filesystems/fuse/fuse.html)、[TiDB Cloud Filesystemのマウント要件](https://docs.pingcap.com/ja/ai/ti-regions-security-and-limitations/))

## Drive9

TiDB Cloud CLIのインストーラーには`ti-drive9`が含まれます。公式ドキュメントでは、`ti-drive9`は`ti fs`などのFilesystem操作を実行するコンパニオンランタイムと説明されています。FUSEやWebDAVのマウントもDrive9が実装します。([TiDB Cloud CLIの設定と認証情報](https://docs.pingcap.com/ja/ai/ti-configuration-and-credentials/)、[リージョン、セキュリティ、制限事項](https://docs.pingcap.com/ja/ai/ti-regions-security-and-limitations/))

Drive9のプロジェクトは、エージェントの作業状態をサンドボックスをまたいで引き継ぐワークスペースを提供しています。([Drive9のREADME](https://github.com/mem9-ai/drive9))

## VPCなしのマウント検証

Dockerコンテナ内でマウントするためのTiDB公式手順には、FUSE3のインストールに加えて、次の設定が載っています。([TiDB公式のDockerマウント手順](https://docs.pingcap.com/tidbcloud-filesystem/filesystem-mount-docker/))

- `/dev/fuse`を`--device /dev/fuse`でコンテナに渡す
- `CAP_SYS_ADMIN`を`--cap-add SYS_ADMIN`で追加する
- `--security-opt apparmor=unconfined`でAppArmorによる制限を外す

`CAP_SYS_ADMIN`はマウントなど複数の管理操作に関わる広い権限です。また、`apparmor=unconfined`はコンテナに適用されるAppArmorプロファイルによる制限を外します。どちらも隔離を弱める設定なので、用途を限定したコンテナで使う必要があります。([Linuxのcapabilities](https://man7.org/linux/man-pages/man7/capabilities.7.html)、[DockerのAppArmorプロファイル](https://docs.docker.com/engine/security/apparmor/))

AWS Lambdaの標準のファイルシステム機能は、EFSまたはS3 Filesをマウントする仕組みです。今回必要な`/dev/fuse`やLinux capabilityを自分で渡す構成とは違うため、Lambda MicroVMから試しました。VPCは作らず、インターネットコネクタもデフォルトのものを使います。([AWS Lambdaのファイルシステム設定](https://docs.aws.amazon.com/lambda/latest/dg/configuration-filesystem.html))

図の出典として、[TiDB Cloud Filesystemの公式ページ](https://www.pingcap.com/tidb/tidb-cloud-filesystem/)を挙げておきます。ページには、複数の実行環境で一つの永続ワークスペースを共有するイメージ図があります。これは今回のLambda MicroVMの構成図ではなく、TiDB Cloud Filesystemが想定する使い方を示した図です。

結果、マウントできました。今回の構成では特に引っかかることもなく、VPCなし・デフォルトのインターネットコネクタでTiDB Cloud Filesystemを使えました。

……で、マウントできた。検証だけなら、これで終わりです。

ただ、今回おもしろかったのは、ファイルシステムをマウントできたことだけではありませんでした。

## エージェントの作業場所

1日目のセッションでは、エージェントがクラウド上のサンドボックスで作業するのは当たり前になりつつある、という話がありました。そうなると気になるのが、作業中のファイルをどこに置くかです。

エージェントが単独で作業し、人間が後から成果を確認するだけなら、S3 SyncやGitHubへのpushで足りるかもしれません。作業中のファイルをリアルタイムに見たい場面は、私はあまり思いつきませんでした。

## ファイル共有とロック

一方、人間とエージェントが同じファイルを同時に扱うなら、共有やファイルロックが意味を持ちそうです。たとえば、誰かが編集中のファイルを別の人が同時に更新しないようにする、といった場面です。

TiDB Cloud Filesystemでロックがどう動くかは、今回確認していません。私なりに考えた使い分けは、いまのところこんな感じです。

| 作業の形 | 保存先の候補 |
| --- | --- |
| エージェントが単独で作業し、後から成果を受け取る | S3 / GitHub |
| 人間とエージェントが同じファイルを同時に扱う | ファイルシステム |

もちろん、どのケースでもこの選択になるという話ではありません。

## まとめ

Lambda MicroVMからTiDB Cloud FilesystemをVPCなしでマウントできました。ただ、検証を通じて考えたのは、エージェントの作業場所にファイルシステムが必要なのかということでした。

エージェントが単独で作業するならS3やGitHubで足りるかもしれません。人間と一緒に同じファイルを扱うなら、共有やロックのためにファイルシステムが役立つ場面もありそうです。
