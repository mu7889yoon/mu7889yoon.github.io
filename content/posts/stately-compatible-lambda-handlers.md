---
date: '2026-08-28T09:00:00+09:00'
draft: true
tags: ['tech', 'aws', 'step-functions', 'typescript']
description: '以前の登壇で紹介したTypeScriptからASLへの変換ツールstatelyが、どこまで進化したのかを実際のhandler.tsと実行結果で紹介します。'
title: 'TypeScriptからASLを生成するstatelyが、結構進化した'
---

よ〜んです。

以前、[【関西開催】AWS Community Builders Meetup 2026 Winter](https://kansai-cbs.connpass.com/event/380534/)で、TypeScriptから[Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)（ASL）へ変換するツールについて発表しました。

そのときに作っていたのが、[stately](https://github.com/mu7889yoon/stately.asl)です。

TypeScriptで書いた処理を、AWS Step Functionsのステートマシン定義へ変換する。

当時はまだ「AWS SDKの呼び出しをASLに置き換えてみる」くらいの雰囲気でした。

そこから、結構進化しました。

今回は、現在のstatelyでどんなhandler.tsをStep Functionsとして表現できるのか、実際にどう使うのか、そして何でもStep Functionsにしてよいのかを書いていきます。

## いまのstatelyは何をするものか

statelyは、TypeScript一般を変換するトランスパイラではありません。

主な対象は、Lambdaの中に書かれた「AWS APIを呼び出す流れ」です。

TypeScriptの構文を、Step Functionsの状態へマッピングします。

| TypeScript | Step Functions |
| --- | --- |
| **await client.send(...)** | **Task** |
| **if/else** | **Choice** |
| **Promise.all(...)** | **Parallel** |
| **for...of** | **Map** |
| **fetch(...)** | **HTTP Task** |

さらに、現在の生成結果はJSONataを使うASLになっています。

~~~json
{
  "QueryLanguage": "JSONata"
}
~~~

入力値の参照には $states.input、Taskの実行結果や条件分岐にはJSONataの式を使います。

つまり、単純にAWS SDKのコードを別のJSONへ変換しているわけではありません。

TypeScriptで書かれた処理の流れを読み取り、Step Functionsの状態とJSONataを組み合わせたステートマシンへ変換しています。

## これぐらいのhandler.tsならStep Functionsで表現できる

例えば、DynamoDBからアイテムを取得し、状態がACTIVEなら削除するLambda Handlerを考えます。

~~~typescript
import {
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";

export async function handler(
  TableName: string,
  Key: Record<string, any>,
) {
  const client = new DynamoDBClient({});

  const result = await client.send(
    new GetItemCommand({
      TableName,
      Key,
    }),
  );

  if (result.Item?.status?.S === "ACTIVE") {
    await client.send(
      new DeleteItemCommand({
        TableName,
        Key,
      }),
    );
  }
}
~~~

このHandlerがやっていることは、ざっくり言えば次の3つです。

- DynamoDBのGetItemを呼ぶ
- 取得結果を確認する
- 条件に合えばDynamoDBのDeleteItemを呼ぶ

これなら、Step Functionsの状態として表現できます。

- GetItemがTask
- ifがChoice
- DeleteItemがTask

生成されるASLは、例えば次のような形になります。

~~~json
{
  "QueryLanguage": "JSONata",
  "StartAt": "getItem_1",
  "States": {
    "getItem_1": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:getItem",
      "Arguments": {
        "TableName": "{% $states.input.TableName %}",
        "Key": "{% $states.input.Key %}"
      },
      "Output": "{% $merge([$states.input, {\"getItem_1Result\": $states.result}]) %}",
      "Next": "Choice_1"
    },
    "Choice_1": {
      "Type": "Choice",
      "Choices": [
        {
          "Condition": "{% ($exists($states.input.getItem_1Result.Item.status.S) and $states.input.getItem_1Result.Item.status.S = \"ACTIVE\") %}",
          "Next": "deleteItem_1"
        }
      ],
      "Default": "Pass_1"
    },
    "deleteItem_1": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:deleteItem",
      "Arguments": {
        "TableName": "{% $states.input.TableName %}",
        "Key": "{% $states.input.Key %}"
      },
      "Next": "Pass_1"
    },
    "Pass_1": {
      "Type": "Pass",
      "End": true
    }
  }
}
~~~

実際には、Taskの結果を後続の入力へマージしたり、エラー時のRetry設定を付けたりします。

それでも、TypeScriptのHandlerを見たときに、

「これは処理を実行しているというより、AWS APIを順番に呼んでいるだけだな」

というコードであれば、Step Functionsへ移せる可能性があります。

## こうやって使います

まず、リポジトリを取得してビルドします。

~~~bash
git clone https://github.com/mu7889yoon/stately.asl.git
cd stately.asl

yarn install
yarn build
npm link
~~~

あとは、変換したいhandler.tsに対して、statelyを実行します。

~~~bash
stately transpile handler.ts --pretty --out workflow.asl.json
~~~

変換前に、対応している構文かどうかを確認することもできます。

~~~bash
stately analyze handler.ts
~~~

analyzeでは、未対応の構文やStep Functionsへ変換できない可能性のある処理を診断します。

例えば、次のような処理は現在のstatelyが苦手です。

- map()やfilter()を使った複雑なデータ加工
- 文字列の分割やCSVのパース
- 通常のforやwhile
- results.push(...)のようなローカル状態の変更
- normalize()のようなユーザー定義関数
- 独自アルゴリズムによる計算

変換に失敗するだけならまだよいのですが、処理を黙って落としたASLが生成されるのは危険です。

そのため、現在は未対応構文を診断し、変換結果を成功扱いにしないようにしています。

## 生成されたASLをStep Functionsで動かす

生成されたworkflow.asl.jsonを、Step Functionsのステートマシン定義として利用します。

AWS SDK統合を使うので、LambdaからDynamoDBを呼び出すのではなく、Step FunctionsからDynamoDBを直接呼び出す構成になります。

TypeScriptのHandlerを書いて、statelyで変換して、生成されたASLをStep Functionsへ登録する。

ここまでやって、実際に動きました。

もちろん、単純なサンプルが動いたからといって、すべてのLambdaを同じように置き換えられるわけではありません。

ただ、以前は「こういうことができたら面白いな」くらいだったものが、実際にAWS上で動くところまで来たのは、かなり大きな進歩だと思っています。

## 何でもかんでもStep Functionsにしていいのか

ここで、少し冷静になる必要があります。

では、Lambdaで書かれた処理を何でもStep Functionsにしてしまってよいのか。

答えはNOです。

Step Functionsへ移したいのは、Lambdaの中にある「オーケストレーション」です。

- どのAWS APIを呼ぶか
- どの順番で呼ぶか
- 条件によってどこへ分岐するか
- 複数の処理を並列に実行するか
- 配列の各要素に対して処理を繰り返すか

このような処理は、Step Functionsの状態として表現しやすいです。

一方で、次のような処理はLambdaに残した方がよいでしょう。

- 大量のデータを加工する
- 複雑な文字列処理をする
- 独自のアルゴリズムを実行する
- 外部ライブラリを使う
- ドメインロジックをまとめて処理する

Step Functionsは、処理の流れを見えるようにするのが得意です。

しかし、状態を細かく分けすぎると、今度はステートマシン定義が読みにくくなります。状態遷移が増えれば、料金や実行時間にも影響します。[Step Functionsの料金](https://aws.amazon.com/step-functions/pricing/)も含めて考える必要があります。

「Step Functionsへ変換できる」と「Step Functionsへ変換すべき」は別の話です。

この線引きを間違えると、Lambdaを消せた代わりに、複雑なステートマシンを運用することになります。

## ここから先は、次の発表で

今回紹介したstatelyは、あくまで「TypeScriptで書いたAWS API呼び出し中心の処理を、Step Functionsへ移す」ためのものです。

では、そもそもなぜLambdaを減らしたいのか。

LambdaというRuntimeをなくすと、どんな世界になるのか。

そして、JSONataを使うとStep Functionsでどこまで処理を表現できるのか。

このあたりの話は、[ServerlessDays Tokyo 2026](https://serverless.connpass.com/event/371637/)で続きとして発表する予定です。

発表タイトルは、「JSONataとAWS Step Functionsで目指すRuntime Lessな世界」です。

statelyの紹介だけで終わらず、Lambdaを残すところ、Step Functionsへ移すところ、そしてRuntimeそのものをどう考えるかまで、もう少し広げて考えてみます。

## まとめ

- statelyは、TypeScriptからStep FunctionsのASLを生成するトランスパイラ
- await、if/else、Promise.all、for...ofをTask、Choice、Parallel、Mapへ変換できる
- 現在の生成ASLはJSONataを使う仕様になっている
- AWS API呼び出し中心のオーケストレーション用Lambdaと相性がよい
- データ加工や複雑なロジックまで、何でも変換できるわけではない
- Step Functionsへ変換できることと、変換すべきことは別

以前の発表で作ったものが、handler.tsを受け取ってASLを生成し、実際にStep Functionsで動くところまで来ました。

まだ変換できる範囲は限定的です。

でも、Lambdaの中に埋もれていた処理の流れを、TypeScriptのまま書き始めて、Step Functionsとして実行できる。

この体験は、なかなか面白いです。

statelyの紹介でした。

ではでは〜
