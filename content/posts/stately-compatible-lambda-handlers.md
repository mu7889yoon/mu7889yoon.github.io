---
date: '2026-08-28T09:00:00+09:00'
draft: true
tags: ['tech', 'aws', 'step-functions', 'typescript']
description: '以前の登壇で紹介したTypeScriptからASLへの変換ツールstatelyで、Lambda HandlerをStep Functionsへ変換してみます。'
title: 'statelyでhandler.tsをStep Functionsに変換してみる。'
---

よ〜んです。

以前、[【関西開催】AWS Community Builders Meetup 2026 Winter](https://kansai-cbs.connpass.com/event/380534/)で、TypeScriptから[Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)（ASL）へ変換するツールについて発表しました。

そのときに作っていたのが、[stately](https://github.com/mu7889yoon/stately.asl)です。

あれから、結構進化しました。

今回は、実際に `handler.ts` を用意して、statelyでStep Functionsの定義へ変換してみます。

## Statelyとは

statelyは、TypeScriptでStep Functionsを書くためのDSLではありません。

TypeScriptのコードを別の書き方で包むのではなく、TypeScriptで書かれた `handler.ts` を解析して、Step Functionsの定義であるASLへ変換します。

ここが、statelyの一番大事なところです。

開発者は、まずTypeScriptで処理を書きます。そのコードをstatelyに渡すと、`await` や `if` といった構文を読み取り、Step Functionsの `Task` や `Choice` に変換します。

つまり、statelyが提案しているのは新しいDSLではなく、**TypeScriptを入力にしてASLを生成するアプローチ**です。

もちろん、TypeScriptなら何でも変換できるわけではありません。AWS APIを呼ぶ流れや、処理の順番・分岐を表現しているコードが主な対象です。

## こんなHandler

今回変換するのは、DynamoDBからアイテムを取得して、状態が `ACTIVE` なら削除するHandlerです。

```typescript
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
    new GetItemCommand({ TableName, Key }),
  );

  if (result.Item?.status?.S === "ACTIVE") {
    await client.send(
      new DeleteItemCommand({ TableName, Key }),
    );
  }
}
```

普通のLambdaとして見ると、DynamoDBを呼んで、結果を見て、条件に合えばもう一度DynamoDBを呼ぶだけです。

この「AWS APIを呼ぶ流れ」は、Step Functionsの状態に置き換えやすいです。

## 変換する

まずはstatelyをビルドします。

```bash
git clone https://github.com/mu7889yoon/stately.asl.git
cd stately.asl
yarn install
yarn build
```

続いて、変換できるコードか確認します。

```bash
stately analyze handler.ts
```

今回の結果はこんな感じでした。

```json
{
  "ok": true,
  "diagnostics": [],
  "metrics": {
    "promiseAll": 0,
    "forOf": 0,
    "tryCatch": 0,
    "ifElse": 1,
    "awaitCalls": 2,
    "sdkCalls": 2
  }
}
```

問題なさそうなので、ASLへ変換します。

```bash
stately transpile handler.ts --pretty --out workflow.asl.json
```

## 生成されたASL

生成されたASLは、ざっくりこのような構造になりました。実際に生成されたJSONから、一部だけ抜き出します。

```json
{
  "QueryLanguage": "JSONata",
  "StartAt": "getItem_1",
  "States": {
    "getItem_1": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:getItem",
      "Next": "Choice_1"
    },
    "Choice_1": {
      "Type": "Choice",
      "Choices": [
        {
          "Condition": "{% ($exists($states.input.getItem_1Result.Item.status.S) and $states.input.getItem_1Result.Item.status.S = \\\"ACTIVE\\\") %}",
          "Next": "deleteItem_1"
        }
      ],
      "Default": "Pass_1"
    },
    "deleteItem_1": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:deleteItem",
      "Next": "Pass_1"
    }
  }
}
```

TypeScriptの `await` は `Task` に、`if` は `Choice` になっています。

DynamoDBの呼び出しも、LambdaからではなくStep FunctionsのAWS SDK統合に置き換わっています。生成されるASLはJSONataを使う仕様なので、入力値は `$states.input` から参照します。

今回の検証では、`analyze` と `transpile` がどちらも成功し、実際にASLファイルが生成されるところまで確認できました。

## 何でも変換しない

ここまで動くと、Lambdaを全部Step Functionsにしたくなります。

しかし、何でも変換すればよいわけではありません。

statelyが得意なのは、AWS APIを呼ぶ順番や条件を組み立てる処理です。

逆に、文字列を加工したり、配列を `map()` や `filter()` で処理したり、独自の関数で計算したりする処理は、今のところLambdaに残した方がよいです。

```typescript
const rows = text
  .split("\\n")
  .filter((line) => line.trim())
  .map((line) => line.split(","));
```

このあたりまでStep Functionsへ持っていくと、Lambdaを消せた代わりに、ステートマシンの方が読みにくくなります。

「変換できる」と「変換すべき」は別の話です。

## まとめ

statelyを使うと、AWS APIを呼び出すだけのLambda Handlerを、Step FunctionsのTaskやChoiceとして表現できます。今回のHandlerは、実際に `analyze` と `transpile` が成功してASLを生成できました。

とはいえ、Lambdaを何でもStep Functionsにすればよいわけではありません。処理の流れはStep Functionsへ、データ加工や複雑なロジックはLambdaへ。この境界を考えるためのツールとして、statelyを育てています。

## 続きは発表で

今回紹介したstatelyは、TypeScriptで書いたLambda Handlerを何でもStep Functionsへ移すツールではありません。

AWS APIを呼び出す流れを、Step Functionsの状態として表現するためのツールです。

では、なぜLambdaを減らしたいのか。

LambdaというRuntimeをなくすと、どんな世界になるのか。

この続きは、[ServerlessDays Tokyo 2026](https://serverless.connpass.com/event/371637/)で発表する予定です。

statelyの紹介でした。

ではでは〜
