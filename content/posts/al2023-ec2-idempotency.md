---
date: '2026-06-15T22:58:01+09:00'
draft: false
tags: ['tech', 'al2023-dive-deep', 'gnu-linux', 'iac', 'cdk']
description: 'EC2 を AWS CDK で管理していても、Session Manager や手動変更を重ねるとサーバーの再現性は少しずつ怪しくなっていきます。cloud-init、AMI、AL2023 の Deterministic updates などを見ながら、EC2 の冪等性について整理します。'
title: 'EC2の冪等性について考えてみる。'
---

よ〜んです。

最近[これ](https://builder-mahjong.click/)を作って運用している影響でよくEC2を触ります。でもAWS CDKで管理していると、色々トラブりがちです...
Session Managerで色々触っていると再現性がどんどん怪しくなっていく…

## 冪等性とは

同じ操作を何回やっても、結果が同じになること。

数学的にいうと `f(f(x)) = f(x)` です。関数 f に同じ入力を何度通しても、出力が変わらない。

インフラの文脈ではもう少し広い意味で使われていて、**「同じ手順を何度実行しても、同じ状態のサーバーができあがる」** ということですね。

逆に冪等じゃない状態のサーバーは [スノーフレークサーバー](https://martinfowler.com/bliki/SnowflakeServer.html)と呼ばれるらしい。

- 引用 [Snowflake Server](https://martinfowler.com/bliki/SnowflakeServer.html)

## EC2 で冪等性が崩れるパターン

### cloud-init

例えば以下

```bash
#!/bin/bash
dnf install -y nginx
systemctl enable --now nginx
```

一見冪等に見えますが、`dnf install` はバージョン未指定なので、実行タイミングで入るバージョンが変わります。

また、cloud-init のモジュールにはそれぞれ実行頻度（`PER_INSTANCE`、`PER_BOOT`、`PER_ONCE`、`PER_ALWAYS`）が設定されていて、実行済みかどうかをセマフォファイルで管理しています。`PER_INSTANCE` のモジュールは同じ instance-id では再実行されないので、AMI から起動し直したときに「あれ、動かない」となることがある。

- [Directory layout - cloud-init 26.1 documentation](https://docs.cloud-init.io/en/latest/development/dir_layout.html#sem)

### AMI スナップショット

「動いてるインスタンスから AMI 作ればいいじゃ〜ん」はなんかイケてそうですが...

- 作成タイミングで中身が微妙に違う
- `/tmp` や `/var/log` にゴミが残る
- SSH ホストキーが使い回される
  - SSHを使うなというのはその通り

### 手動変更

人間は楽な方に流れる生き物...

 `dnf update` したり設定ファイルを直接編集したりすると、もう二度と同じものは作れない。

## 冪等性を担保するためには？

### SSM / SSH しない

**そもそもインスタンスに入らない。**

これが一番大事。

手動変更が入った瞬間に冪等性は崩れるので、「インスタンスは使い捨て」という前提で設計し、設定変更はすべてコードに落として、新しいインスタンスを作り直す。

### Packer / EC2 Image Builder

[Packer](https://www.packer.io/) は HashiCorp が開発しているオープンソースのマシンイメージビルドツール。HCL（HashiCorp Configuration Language）でテンプレートを書いて、AMI やコンテナイメージを自動で焼いてくれます。

やってることはシンプルで

1. ベース AMI から一時的な EC2 インスタンスを起動する
2. SSH で接続して、シェルスクリプトや Ansible 等でプロビジョニングする
3. プロビジョニングが終わったらインスタンスから AMI を作成する
4. 一時インスタンスを破棄する

Packer 自体は無料。ビルド中の EC2 インスタンス料金だけかかる。AWS 以外にも Azure、GCP、Docker など複数のプラットフォームに対応しているのが特徴ですね。

ちなみに AWS には [EC2 Image Builder](https://docs.aws.amazon.com/imagebuilder/latest/userguide/what-is-image-builder.html) というフルマネージドの AMI ビルドサービスもあります。AWS に閉じるなら Image Builder、マルチクラウドであれば Packerという使い分けかなと。

Packerはまた触ってみます、すません。

### SSM State Manager でドリフト検知

[Systems Manager の State Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-state.html) を使えば、定期的に「あるべき状態」を適用し続けることができます。

手動変更が入っても気づけるのは助かりますね。ドリフト検知的な使い方ができる。

気になるお値段ですが、**State Manager は追加料金なし**です。SSM の無料枠に含まれてる。えらい。

（Run Command、Fleet Manager、メンテナンスウィンドウなども無料。SSM は太っ腹ですね）

## AL2023 固有の話

### Deterministic updates

AL2023 はリポジトリのバージョンロックができます。特定時点のパッケージセットを固定できるので、「いつ `dnf install` しても同じバージョンが入る」が実現できる。

これは冪等性を担保する上でめちゃくちゃ重要な機能。

## まとめ(？)

要するに SSM / SSH するなって話ですね、あとはAL2023の機能に乗っかっておくと幸せになれそう。

ところで、よく考えたら Packer って EC2 版の Dockerfile みたいなもんじゃない？ベースイメージ指定して、プロビジョニングして、イメージ焼く。やってること同じですね。

久しぶりのブログなので最後どんな感じで締めていたか忘れちゃいました。
