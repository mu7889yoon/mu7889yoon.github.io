---
date: '2026-02-22T17:49:55+09:00'
draft: false
tags: ['tech', 'aws','ec2','kvm']
description: 'EC2のネストされた仮想化を使って、Ubuntu上でKVMを動かしたときのメモです。'
title: 'EC2が仮想化のネストに対応したので、UbuntuでKVMを動かす。'
---

よ〜んです。

先日、Amazon EC2のC8i、M8i、R8iタイプでネストされた仮想化に対応した、というアナウンスが出ました。

[Amazon EC2 supports nested virtualization on virtual Amazon EC2 instances](https://aws.amazon.com/jp/about-aws/whats-new/2026/02/amazon-ec2-nested-virtualization-on-virtual/)

どうしてもx86_64マシン上のKVMで検証したいことがあったのですが、手元にx86_64環境がなくて困っていたので、これはかなり助かります。

> 「ベアメタルインスタンスでよくない？」

はい、正論です。ただ今回はコスト観点で見送りました。

今回はUbuntuを使います。Amazon Linux 2023でもできなくはないですが、kvm関連パッケージのビルドが必要であったりで面倒そうだったのでUbuntuにしました。

## 今回やること

- EC2をネストされた仮想化有効で起動する
- UbuntuにKVM一式を入れる
- `kvm-ok` で `/dev/kvm` が使えることを確認する

## EC2側の設定メモ

ポイントはCPUオプションです。

```bash
--cpu-options "NestedVirtualization=enabled"`
```

この記事執筆時点(2026/02/22)では、CDK/CloudFormationから指定できなさそうであっ他ため、今回はカスタムリソース経由で作成しました。

## Ubuntu側のセットアップ

KVM関連をまとめて入れます。

```bash
sudo apt update
sudo apt install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils cpu-checker
```

確認コマンド:

```bash
kvm-ok
```

## はまりどころ

今回つまずいたのはこのあたりです。

- Amazon Linux 2023前提の記事をそのままなぞると、パッケージ名差分で詰まりやすい
- ネスト仮想化有効化が抜けていると、`/dev/kvm` があっても期待どおり動かないケースがある

## 結果

以下の出力になり、KVMアクセラレーションが利用可能な状態を確認できました。

```bash
$ kvm-ok
INFO: /dev/kvm exists
KVM acceleration can be used
```

今回はここまでです。次回はこの上でDebian GNU/Hurdを動かしてみます。
