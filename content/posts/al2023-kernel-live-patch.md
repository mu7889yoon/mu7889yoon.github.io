---
date: '2026-05-06T17:13:04+09:00'
draft: false
tags: ['tech', 'al2023-dive-deep', 'gnu-linux']
description: 'セキュリティリスクへの迅速な対応を可能にするKernel Live Patchingで再起動なしで脆弱性を修正できる場合もあります。'
title: 'Kernel Live Patching ってなんだ？'
---

よ〜んです。

[AL2023 Deep Dive シリーズ](/posts/learn-the-finer-points-of-amazon-linux/)の一環…なんですが、今回はちょっと毛色を変えて **Kernel Live Patching** の話です。Amazon Linux 2023 そのものの深掘りというより、Amazon Linux 2023でも使えるLinuxカーネルのお話になります。

最近クリティカルな CVE が多いですね。カーネルの更新となると再起動を伴うわけですが、本番で動いてるサーバーを気軽に再起動できるわけもなく、かといってセキュリティパッチを放置するのも気持ち悪い。

そんなときに使えるのが Kernel Live Patching ですね。

## Kernel Live Patching

一言でいうと、**動いてるカーネルに対して、再起動なしでパッチを当てる仕組み**です。

Linux カーネル 4.0 から入った `livepatch` という機能がベースになっていて、内部的には **functoin tracer(ftrace)** を使ってカーネル関数の呼び出し先を差し替えます。

つまり、脆弱性のある関数が呼ばれたとき、ftrace が「いや、こっちの修正済み関数を使ってね」と差し替えてくれるわけですね、素晴らしい

## パッチ適用後、当該環境は不安定にならないのか。

**Kernel Live Patchingはあくまで「再起動までの繋ぎ」** 

パッチが蓄積していくとカーネル内部の関数リダイレクトが増えていくので、長期間再起動なしで運用し続けるのは推奨されていません。

> AWS は、AL2023 カーネルバージョンのリリースから 3 か月間、カーネルライブパッチを提供します。その後、カーネルライブパッチを引き続き入手するには、新しいカーネルバージョンに更新する必要があります。
> [Kernel Live Patching on AL2023 - Amazon Linux 2023](https://docs.aws.amazon.com/ja_jp/linux/al2023/ug/live-patching.html) より

とあるので、「3 ヶ月目安でカーネルを更新してね」というサイクル推奨しているように見えます。
## AL2023 での Live Patching

AL2023 でも [Kernel Live Patching](https://docs.aws.amazon.com/linux/al2023/ug/live-patching.html) が公式にサポートされています。

### 対応環境

- **アーキテクチャ**: x86_64 / ARM64
- **動作環境**: EC2、オンプレミスの VM
- **コスト**: 追加料金なし（ここ大事）

ちなみに他の OS だとライブパッチは有料だったりします。Ubuntu は [Livepatch](https://ubuntu.com/security/livepatch) が Ubuntu Pro（商用利用は有料）の一部の機能だったりします、AL2023 なら追加料金なしで使えるのはありがたいですね。

### 有効化の手順

```bash
# kpatch のインストール
sudo dnf install -y kpatch-runtime

# kpatch サービスの有効化
sudo systemctl enable --now kpatch.service

# 利用可能なライブパッチの確認
sudo dnf list available kernel-livepatch*

# ライブパッチの適用
sudo dnf install -y kernel-livepatch-<version>

# 適用状況の確認
kpatch list
```

Systems Manager を使えば、複数インスタンスにまとめて適用することもできます。パッチベースラインに組み込めるのは運用的にめちゃくちゃ助かりますね。

### メリット

- **ダウンタイムなし**: 再起動不要なので、サービスを止めずにパッチが当たる
- **追加コストなし**: AL2023 を使っていれば無料
- **SSM 連携**: Systems Manager でフリート管理できる
- **即時適用**: メンテナンスウィンドウを待たずに緊急パッチを当てられる

### デメリット

正直なところ、万能ではないです。

- **パッチ提供期間は 3 ヶ月**
	- カーネルバージョンのリリースから 3 ヶ月間だけ。それ以降は新しいカーネルに上げる必要がある
- **すべての修正がライブパッチで提供されるわけではない**
	- 技術的制約で対応できない修正は通常のカーネルアップデート + 再起動が必要
- **ハイバネーション不可**
	- ライブパッチ適用中は EC2 のハイバネーション（RAM の内容を EBS に退避してインスタンスを停止する機能）が使えない

## まとめ

セキュリティパッチの即時適用にはめちゃくちゃ便利ですが、パッチ提供期間は 3 ヶ月で、eBPFとの共存もできない。あくまで「再起動までの繋ぎ」として運用に組み込むのが正しい立ち位置かなと思います。

ではでは〜

