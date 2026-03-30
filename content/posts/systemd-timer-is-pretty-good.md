---
date: '2026-03-17T20:00:46+09:00'
draft: false
tags: ['tips', 'tech', 'linux', 'systemd', 'amazon-linux', 'al2023-dive-deep']
description: 'Amazon Linux 2023では、cronよりもsystemd timerが定時実行の推奨環境となり、ログ記録、ステート管理、リトライ機能が標準搭載されています、それらについて調査しました。'
title: 'systemd timer が結構いい'
---
お久しぶりです、よ〜んです。

UNIXやGNU/Linuxのジョブの定時実行といえば`cron`ですが、Amazon Linux 2023 （AL2023）では定時実行を`systemd timer`で行うことが推奨されているようです。

[AL2023 で廃止 - Amazon Linux 2023](https://docs.aws.amazon.com/ja_jp/linux/al2023/ug/deprecated-al2023.html#deprecated-crona)

## なぜ`systemd timer` が推されているのか

GNU/Linuxでは、サービス管理、起動順序、ログ、失敗時の扱いが`systemd` に集約されています。

だったら、定期実行も同じ世界に載せたほうが運用しやすい、ということだと私は考えます。

### デフォルトでログが記録される

`cron`はログを保存しません。

なので、ログを残す場合、以下のような**おまじない**をしてあげる必要がありました。

```sh
* * * * * command >> /var/log/job.log 2>&1
```

> コーディングエージェントが良くやるやつですね
>
### ステートがある

もちろん`cron`でもログを残したり、終了したらDBに状態を格納したり、Discordなどに通知する仕組みを入れておくことで状態を持たせることは可能です。

一方、`systemd timer`(というか`systemd`)では、↑のような一手間を加えずに状態を持ちます。

### リトライがある

そして、`systemd`側で状態を持っているということは、リトライが可能になります。

`cron`でも実行するジョブ側に自前実装でリトライさせることは可能です。

`systemd service` (NOT `systemd timer`)なら、失敗時の扱いを記述し、リトライさせることが可能です。

```sh
Restart=on-failure
RestartSec=30s
OnFailure=
```

`systemd timer`の機能の一つである`Persistent` を使うことで、例えば10時に実行するjobがあったときに、ジョブ実行を行なっている計算機がシャットダウンしていても、計算機起動後にジョブを実行してくれます。

実行時間に厳密である必要はないが、大体このぐらいの時間に実行してほしいといったパターンにめっちゃ便利だなと思いました。

---

上記のような点から、`systemd timer`では`cron`で自前実装・不便だったポイントが標準で揃っていることがわかりました。

## `cron`から`systemd timer`に移行するには

たとえば、こういう `cron` があったとします。

```cron
0 3 * * * /usr/local/bin/daily.sh
```

まずは**何を実行するか** を `.service` に、**いつ実行するか** を `.timer` に書いていきます。

### service 側

```ini
# /etc/systemd/system/daily.service
[Unit]
Description=daily task
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=ec2-user
WorkingDirectory=/opt/daily
ExecStart=/usr/local/bin/daily.sh
```

ここに「ジョブの本体」を書きます。  
必要なら `EnvironmentFile=` や `Restart=on-failure`、`RestartSec=30s` もここに足せます。

`ExecStartPre` などを使うことで、
他にも、TimeoutStopSecを使うことで、

### timer 側

こちら完全に定時実行のための設定を記述していきます。

```ini
# /etc/systemd/system/daily.timer
[Unit]
Description=Run daily job every day

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now daily.timer
```

system確認系のコマンドも、`cron` よりかなり分かりやすいです。

```sh
# 実行予定を確認
systemctl list-timers
# ステータスの確認
systemctl status daily.timer
# ログの確認(これは .service)
journalctl -u daily.service
```

見通しがかなり良くなりそうな気がしてます。

## まとめ

`cron` は全然使えますし、自宅サーバーとかやったら`cron`使うかなって感じです。

ただ、AL2023 では推奨されていますし、実際のところプロダクションを見据えたとき、運用の見通しはかなりよくなると思いました。

## `cron`の思い出

`cron`の思い出といえば、私がちょっとシェルを書けるようになった後に知りましたね…

`cron`を知る前はwhileループで現在の時間を取得して…みたいな馬鹿げたことをしていました…

もちろんデーモンという概念も知らない時です。

効率よくするために、一つのプログラムに複数のジョブを定義して時間で分岐することとかやってたり…

大学の出席(evil)とか、車校の予約(超evil)とか、ほんとに、そのままの今で私の人生を支えてきてくれていたなぁなどと

ではでは

[systemd(1) - Linux manual page](https://man7.org/linux/man-pages/man1/systemd.1.html)

[systemd.timer(5) — Linux manual page](https://man7.org/linux/man-pages/man5/systemd.timer.5.html)
