---
date: '2025-12-24T12:00:00+09:00'
draft: false
tags: ['tech', 'tips', 'aws', 'step-functions']
description: 'JAWS-UG Osakaで発表した、AWSあるあるの中で、Step Functionsで対応してAWS APIは使えないというあるあるを発表しました。その詳細について本記事で掘り下げます。'
title: 'Step Functionsで対応してないAWS APIは使えない'
---

好きなAWSサービスは、Amazon LightsailとAmazon Step Functionsなよ〜んです。AWS CDKももちろん好きです。

> 本記事の内容は、[JAWS-UG大阪2025 忘年勉強会 FSF](https://jawsugosaka.connpass.com/event/374553/)で発表した[AWSあるある](https://speakerdeck.com/mu7889yoon/jaws-ugda-ban-wang-nian-mian-qiang-hui-fsf-awsaruaru)にて10個発表したうちの6個目について掘り下げていきます。

## はじめに

**対応してない**とは左のメニューで検索した時、当該のAWS APIが表示されない状況のことを指します。

本記事は、現時点(2025/12/25)で対応していないAPIを無理やり動かそうとしたけどダメでしたよ。という内容について書きます。

## 大前提として

Step Functionsほぼ全てのサービス・AWS APIをカバーしています。できないことを探す方が大変です。（今回は偶然発見しました。）

今回注目するAWS APIは[CloudFront::CreateDistributionTenant](https://docs.aws.amazon.com/ja_jp/cloudfront/latest/APIReference/API_CreateDistributionTenant.html)です。

## 無理やり使ってみる

まず、検索欄に`CreateDistributionTenant`と入力します

![](/images/019b5127-f4fc-77cd-86c3-9a32e5785d9a.png)

`CreateDistribution`は表示されていますが、`CreateDistributionTenant`は見当たりません...

ですが、Step FunctionsはJSONで記述することが可能です！

![](/images/019b5125-4d24-7751-8b80-4a189c569684.png)

ということは、「画面にないだけで、使えるんじゃね？」と思うのがギークの性、早速試してみましょう。

```json
{
  "Comment": "A description of my state machine",
  "StartAt": "無理やり動かしたい",
  "States": {
    "無理やり動かしたい": {
      "Type": "Task",
      "Arguments": {
        "DistributionId": "EXAMPLE-DISTRIBUTION-ID",
        "Name": "muriyari",
        "Domains": [
          {
            "Domain": "muriyari.example.com"
          }
        ]
      },
      "Resource": "arn:aws:states:::aws-sdk:cloudfront:createDistributionTenant",
      "End": true
    }
  },
  "QueryLanguage": "JSONata"
}
```

![](/images/019b5137-48fb-7925-93e4-4e61ed48d217.png)

なんか動きそうですね、`DistributionId`や`Domain`を有効な物に置き換え、保存してみます...！

![](/images/019b5142-9947-76aa-b83d-fa1278380919.png)

ですよね〜w

この後も、リージョンを変えたり、2Byte文字を取り除いたりなど色々試したましたが、動きませんでした。

## こんなことも出来るよね

「意味ある？」とか「開発者ツールでやった方が早い」とかはさておき

![](/images/019b5147-5892-7f52-b862-31fe9bcc6d0d.png)

## まとめ

> 対応してないものは対応していない。

でも、これで動いたらめちゃくちゃ嬉しいので、似たような件を見つけるとついつい試してみちゃいますよね。

他にもこういうのがあれば試して記事化しようと思います。

ではでは
