---
date: '2026-03-30T19:38:19+09:00'
draft: false
tags: ['tech', 'al2023-dive-deep']
description: 'IPv4のSSL接続をIPアドレスに対して行う方法を、Lets EncryptのIPアドレス証明書とRFC 8738の技術に基づいて、certbotを使った取得手順を含めて解説します。'
title: 'IPアドレスでSSL証明書を取得できるようになったらしい'
---

よ〜んです。

AL2023をだいぶディープシリーズの検証中にIPv4でSSL接続したくなりました。

通常、HTTPS通信を行うにはドメインを取得し、そのドメインに対してSSL/TLS証明書を発行します。AWSでもCloudFrontやALBを使い、ドメインベースでHTTPS化する構成がよく使われています。

ただ、今行っている検証では、CloudFrontを前段に置くのが面倒ですw

そこで今回は、IPアドレスに対して証明書を発行し、本当にIP直アクセスでSSL接続できるのか見ていきます。

## Let’s EncryptのIPアドレス証明書

Let’s Encryptは、2026年1月15日にIPアドレス証明書の一般提供を開始しました。

こちらの証明書は160時間(約6日間)の短命証明書として提供されます。

この機能はLet’s Encrypt独自の拡張ではなく、ACMEのIPアドレス検証拡張に基づいています。公式発表でも、IPアドレスをSubject Alternative Nameに含めた証明書を提供し、検証方式として `http-01` と `tls-alpn-01` を利用することが案内されています。

参考 : [6-day and IP Address Certificates are Generally Available -  Let's Encrypt](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability?utm_source=chatgpt.com)

## RFC 8738

今回の技術の土台になっているのは、**RFC 8738: ACME IP Identifier Validation Extension** です。

これは、ACMEがIPアドレスに対して証明書を発行できるようにするための拡張仕様です。RFC 8738では、IPv4とIPv6の両方を識別子として扱えるようにし、既存のACMEチャレンジやTLS-ALPN拡張を使ってIPアドレスを検証する方法が定義されています。

あくまで、証明書自動発行プロトコルであるACMEに対して、「ドメイン名だけでなくIPアドレスも検証対象にできるようにした」だそうです。
仕様的にIPv6も明確に対象に含まれているため、IPv4だけでなくIPv6でも証明書を取得できます。

参考 : [RFC 8738: Automated Certificate Management Environment (ACME) IP Identifier Validation Extension](https://www.rfc-editor.org/rfc/rfc8738)

## ACMEについて

ACMEは **Automatic Certificate Management Environment** の略で、証明書の発行・更新・検証を自動化するためのプロトコルです。Let’s Encryptの基盤になっているようです。

なお、ここでいうACMEはAWS Certificate Manager（ACM）のことではなく、証明書自動発行のための標準プロトコルの話です。

## 早速取得してみる

まずはcertbotをインストールします。

apt系で入れると結構古めの物がインストールされるのでご注意ください。
(AL2023だいぶディープなのに何故Debian系なんだ？というツッコミは一旦なしでお願いします🙇)

```sh
sudo snap install --classic certbot

sudo certbot certonly \
  --preferred-profile shortlived \
  --standalone \
  --ip-address ${YOUR_IP_ADDRESS}
```

プロンプトに従い、メールアドレスなどを入力していきます。

![](/images/019d3dee-9f80-710c-a14c-42172fc00832.png)

証明書はドメインに対して発行するものという理解だったので、IPアドレスをそのまま指定して証明書を取得し、本当にそのままHTTPS通信が出来てしまいました。

## まとめ

IPアドレスに対する証明書発行は、今まで見かけなかったので、何かしらの技術的制約で不可能なのかと思っていました。

なので、IPアドレスの証明書は裏側で特殊な仕組みが動いているのかと思っていましたが、実際には思ったよりシンプルな仕組みでした。

病院で診察してる時にRFC大好き医師と出会って、「読んだ方がいいよ」みたいな話をしたので、初めてRFCを読んでみましたが、結構読めましたね。いい経験となりました。

ではでは〜
