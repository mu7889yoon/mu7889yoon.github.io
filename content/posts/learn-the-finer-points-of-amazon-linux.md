---
date: '2026-03-11T20:42:28+09:00'
draft: false
tags: ['tech', 'al2023', 'al2023-dive-deep']
description: 'Amazon Linux 2023をだいぶディープしていくために、これから触りたいテーマを先に並べておく記事です。'
title: 'Amazon Linux 2023 だいぶディープ(Dive Deep)'
---

よ〜んです。

最近、Amazon Linux 2023をちゃんと触りたい気持ちが強くなってきました。なので、Amazon Linux 2023をだいぶディープ（Dive Deep）していくために、気になっていることを先に並べておきます。

アウトプットできたものは、この記事にリンクを足していきます。

## Amazon Linux 2023だいぶディープでやりたいこと

- systemd timer
    - `cron`感覚で雑に触ってきたので、`systemd service`との関係から整理したい
    - EC2上で定期実行を置くときに、どこまで素直に書けるのか見たい
- EC2の冪等性
- DCV
- Amazon LinuxのGUI

---

ちょっとカテ違いかも

- IPv4の証明書
    - ドメイン前提で考えがちな証明書まわりを、IPv4アドレス起点でどこまで扱えるのか整理したい
    - `curl`やブラウザの見え方まで含めて確認したい

