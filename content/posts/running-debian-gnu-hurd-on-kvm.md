---
date: '2026-02-23T00:51:02+09:00'
draft: false
tags: ['tech', 'aws','ec2','kvm','debian','hurd']
description: 'EC2上のKVMでDebian GNU/Hurdを起動し、GNU/MachとGNU Emacsの動作を確認した記録です。'
title: 'KVMでDebian GNU/Hurdを動かす'
---

よ〜んです。

[前回](https://mu7889yoon.github.io/posts/ec2-supports-nested-virtualization-so-lets-try-running-kvm/)の記事の続きです。

[EC2が仮想化のネストに対応したので、UbuntuでKVMを動かす](https://mu7889yoon.github.io/posts/ec2-supports-nested-virtualization-so-lets-try-running-kvm/)

今回は、KVM上でDebian GNU/Hurdを起動してみます。

## GNU/Hurdとは

GNU/Hurdは、GNU/Mach上でHurdサーバ群が動いてOS機能を提供する構成です。Linuxのような単一カーネル構成とは設計思想が異なります。

ここでよく出てくる用語をざっくり整理しておきます。

- モノリシックカーネル
  - Linuxのように、プロセス管理・メモリ管理・ファイルシステム・デバイスドライバなどを、基本的にカーネル空間で一体的に扱う方式
- マイクロカーネル
  - カーネル本体は最小限（スケジューリングやIPCなど）に絞り、OS機能の多くをユーザー空間のサーバとして分離する方式

GNU/Hurdは後者寄りの思想で、GNU/Machの上にHurdサーバを載せる構造になっています。動作確認をしていると、Linuxを前提にしたときとは見え方が少し変わって面白いです。

2025年8月に Debian GNU/Hurd 2025 が公開され、amd64向けイメージが案内されていました。

- [Debian GNU/Hurd 2025 released!](https://www.debian.org/ports/hurd/hurd-news.en.html)
- [Debian GNU/Hurd](https://www.debian.org/ports/hurd/)

手元にx86_64マシンがなくて触れなかったのですが、前回のEC2 + KVM環境ができたので試せました。
## 起動準備

Debian GNU/Hurd用イメージは[こちらから](https://www.debian.org/ports/hurd/hurd-cd.ja.html)取得できます。

```bash
wget https://cdimage.debian.org/cdimage/ports/13.0/hurd-amd64/debian-hurd-amd64.img
```

起動コマンドは以下です。

```bash
qemu-system-x86_64 \
  -enable-kvm \
  -cpu host,-svm \
  -m 1G \
  -drive file=debian-hurd-amd64.img,format=raw,cache=writeback \
  -nic user,model=rtl8139 \
  -vnc 127.0.0.1:1 \
  -monitor stdio
```

EC2上で動かしているので、画面確認はSession Managerのポートフォワーディング経由でVNCを使いました。

```bash
aws ssm start-session \
  --target ${INSTANCE_ID} \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["5901"],"localPortNumber":["5901"]}'
```

## 動作確認

まず `uname -a` を実行し、GNU/Machベースで起動していることを確認しました。
![](https://mu7889yoon.github.io/images/019c8525-8e9a-72f9-9751-d94af17a80c1.png)

表示にLinuxが含まれておらず、`GNU-Mach` となっているので、Linuxカーネルではないことが分かります。

GNU Emacsも起動してみました。
![](https://mu7889yoon.github.io/images/019c8525-cedb-792e-be4d-f0872b1439c1.png)

## まとめ

RMSが「自由なUnix互換OS」を目指して初めてきた、GNU/HurdがKVM上でトラブルなく動いたのをみて、ゴールがかなり近づいてきているのかなと思いました。

私はRMSのGNUプロジェクトを応援していますし、今後もできるだけ `GNU/Linux` と呼んでいきます。ではでは。

[なぜGNU/Linuxと呼ぶべきか?](https://www.gnu.org/gnu/why-gnu-linux.ja.html)
