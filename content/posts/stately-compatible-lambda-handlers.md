---
date: '2026-08-28T09:00:00+09:00'
draft: true
tags: ['tech', 'aws', 'step-functions', 'typescript']
description: 'TypeScriptからAmazon States Languageを生成するstatelyで、どのようなLambda HandlerをStep Functionsへ変換できるのか、現時点の対応範囲と苦手な処理を整理します。'
title: 'どんなLambda HandlerならStep Functionsに変換できるのか？'
---

よ〜んです。

最近、[stately](https://github.com/mu7889yoon/stately.asl) というものを作っています。

TypeScriptで書いた関数から、[Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html) を生成するトランスパイラです。

やりたいことはシンプルで、Lambdaに書かれたオーケストレーション処理を、Step Functionsのワークフローとして書き換えたい。

ただ、「TypeScriptをStep Functionsに変換できます」と言うと、普通のTypeScriptなら何でも変換できそうに見えるんですよね。

流石にそんなに甘くはありません。

この記事では、現時点のstatelyでどんなLambda Handlerなら変換しやすいのか、逆にどんなHandlerはLambdaに残した方がいいのかを整理します。

## 先に結論

statelyが得意なのは、**処理そのものではなく、AWS APIやHTTP APIを順番に呼び出すLambda**です。

感覚的には、次のようなLambdaが対象になります。

| Lambdaの主な処理 | 変換先 | 相性 |
| --- | --- | --- |
| `await client.send(...)` | `Task` | ◎ |
| `if/else` | `Choice` | ◎ |
| `Promise.all(...)` | `Parallel` | ○ |
| `for...of` | `Map` | ○ |
| `fetch(...)` / `https.request(...)` | `HTTP Task` | ○ |
| `.map()` / `.filter()` / `.reduce()` | なし | △〜× |
| 文字列加工や複雑な計算 | なし | × |
| ユーザー定義関数の呼び出し | なし | × |

つまり、次のようなコードです。

```typescript
const result = await client.send(
  new GetItemCommand({ TableName, Key }),
);

if (result.Item?.status?.S === "ACTIVE") {
  await client.send(
    new DeleteItemCommand({ TableName, Key }),
  );
}
```

これは、AWS APIを呼び出して、結果に応じて次のAWS APIを呼び出しています。

このような処理であれば、Step Functionsの`Task`と`Choice`にかなり素直に対応づけられます。

一方で、CSVをパースしたり、配列を加工したり、独自の計算をしたりするLambdaは、今のstatelyの対象外です。

ここを見誤ると、「変換は成功したのに、処理が消えている」という一番怖い状態になりかねません。現在は未対応構文を診断して、変換を失敗させるようにしています。

## Step Functionsに置き換えたいLambdaとは

Step Functionsは、AWSサービスのAPI呼び出しや、複数の処理の順序・分岐・並列実行をワークフローとして表現できます。[AWS SDK統合](https://docs.aws.amazon.com/step-functions/latest/dg/integrate-services.html)を使えば、対応するAWSサービスをLambdaを経由せずに呼び出せます。

また、[HTTP Task](https://docs.aws.amazon.com/step-functions/latest/dg/call-https-apis.html)を使って、HTTPSエンドポイントを呼び出すこともできます。

これまでLambdaに書いていた、次のような処理が候補です。

- DynamoDBを読んで、状態によって後続処理を分岐する
- 複数のAWS APIを順番に呼び出す
- 複数のAWS APIを並列に呼び出す
- 配列の各要素に対して同じAWS APIを呼び出す
- AWS APIを呼び出したあとにWebhookを叩く

こういうLambdaは、ビジネスロジックというより「処理の流れ」を持っています。

この「処理の流れ」をStep Functionsへ移したい、というのがstatelyの出発点です。

## 直列実行は一番わかりやすい

まずは、AWS SDKを順番に呼び出すだけのHandlerです。

```typescript
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

export async function handler(
  TableName: string,
  Key: Record<string, any>,
  Item: Record<string, any>,
) {
  const client = new DynamoDBClient({});

  await client.send(new PutItemCommand({ TableName, Item }));
  await client.send(new GetItemCommand({ TableName, Key }));
}
```

このコードは、ざっくり次のようなASLになります。

```json
{
  "QueryLanguage": "JSONata",
  "StartAt": "putItem_1",
  "States": {
    "putItem_1": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:putItem",
      "Next": "getItem_1"
    },
    "getItem_1": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:getItem",
      "End": true
    }
  }
}
```

実際には、入力値を`Arguments`へ渡したり、Taskの結果を後続の入力へマージしたり、デフォルトの`Retry`設定を付けたりします。

ここで重要なのは、TypeScriptの1行をそのまま別の言語へ翻訳しているわけではないことです。

```text
await client.send(...)  ->  Task
```

という、Step Functionsの状態へのマッピングを行っています。

## if/elseはChoiceになる

AWS APIの結果を使って分岐するHandlerも、statelyが得意なパターンです。

```typescript
const result = await client.send(
  new GetItemCommand({ TableName, Key }),
);

if (
  result.Item?.status?.S === "ACTIVE" &&
  Number(result.Item?.expiresAt?.N) <= Date.now()
) {
  await client.send(
    new DeleteItemCommand({ TableName, Key }),
  );
} else {
  await client.send(
    new PutItemCommand({ TableName, Item }),
  );
}
```

この場合、最初の`GetItem`が`Task`になり、その結果を使う`if/else`が`Choice`になります。

statelyは、Taskの結果を`getItem_1Result`のような名前で後続の入力に残します。さらに、現在は次のような条件も扱えます。

- `===` / `!==`
- `&&` / `||` / `!`
- `== null`
- Optional Chaining
- `Number(...)`
- `String(...)`
- `Date.now()`
- `Date.parse(...)`

これらは、Step FunctionsのJSONata式へ変換されます。[Step Functionsでは`QueryLanguage`にJSONataを指定できます](https://docs.aws.amazon.com/step-functions/latest/dg/transforming-data.html)。

このあたりまで来ると、単なる「AWS SDK呼び出しの置換」ではなく、Taskの実行結果を含めたデータフローの変換になってきます。

## Promise.allはParallelになる

複数のAWS APIを同時に呼びたい場合、Lambdaでは`Promise.all`を書くことがあります。

```typescript
await Promise.all([
  client.send(new GetItemCommand({
    TableName,
    Key: key1,
  })),
  client.send(new GetItemCommand({
    TableName,
    Key: key2,
  })),
]);
```

これはStep Functionsの`Parallel`に対応します。

Lambdaで実行すると、同じLambda実行環境の中で非同期処理を並列に動かします。

Step Functionsへ移すと、並列な処理の単位が状態として見えるようになります。どこで分岐して、どこで合流したのかを、実行履歴から追いやすくなるのが嬉しいところです。

とはいえ、並列化したから常に速くなるわけではありません。呼び出し先のスロットリングや、同時実行数、料金は別途考える必要があります。このあたりはトランスパイラの責任ではなく、生成されたワークフローを運用する側の責任です。

## for...ofはMapになる

配列の各要素に対してAWS APIを呼び出す処理は、`for...of`で書けます。

```typescript
for (const item of items) {
  await client.send(
    new PutItemCommand({
      TableName,
      Item: item,
    }),
  );
}
```

これはStep Functionsの`Map`に対応します。

ただし、普通の`for`文ではありません。

```typescript
for (let i = 0; i < items.length; i++) {
  // 現在のstatelyでは対象外
}
```

また、`for...of`の中で複雑なローカル計算をしている場合も、単純にMapへ変換できるとは限りません。

```typescript
for (const item of items) {
  const normalized = normalize(item);
  results.push(calculate(normalized));
}
```

Step FunctionsのMapへ移したいのは、あくまで「各要素に対してTaskを実行する」部分です。

## HTTP呼び出しも対象になる

AWS SDKだけではなく、HTTP呼び出しも対象にしています。

```typescript
await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: payload,
});
```

このような呼び出しは、Step FunctionsのHTTP Taskへ変換できます。

ただし、HTTP Taskには接続設定や認証の仕組みがあります。Lambdaの中で環境変数を読んで、axiosにトークンを渡している処理を、そのまま置き換えられるわけではありません。

「HTTPを呼んでいるから変換できる」ではなく、Step Functions側の接続・認証モデルに合わせられるHTTP呼び出しが対象、と考えた方がよさそうです。

## 逆に、変換が難しいLambda

ここまでの例を見ると、「結構いけるやん」と思うかもしれません。

しかし、statelyが苦手なのは、Lambdaの中でデータを加工する処理です。

例えば、次のようなCSV処理です。

```typescript
const csvText = await readFromS3();

const lines = csvText
  .split("\n")
  .filter((line) => line.trim());

const results = [];

for (const line of lines) {
  const values = line.split(",");
  results.push(normalize(values));
}

return results;
```

この処理の中心は、S3から読むことではありません。

- 文字列を分割する
- 空行を除外する
- CSVを配列へ変換する
- 値を正規化する
- 結果を配列へ追加する

という、CPU上のデータ加工です。

これをStep FunctionsのTaskやMapへ無理やり変換しようとすると、JSONataで表現できる部分と、表現できない部分が混ざってしまいます。

そのため、statelyでは未対応構文を検出したら、診断結果を返します。

```bash
stately analyze handler.ts
```

例えば、現在のテストでは次のような処理をエラーとして扱っています。

- `split()`や`filter()`を使ったデータ加工
- 通常の`for` / `while`ループ
- `results.push(...)`のような配列変更
- `normalize()`のようなユーザー定義関数
- 動的な関数呼び出し
- 複雑なTask入力

対象外の構文を黙って無視してしまうと、生成されたASLはJSONとして正しくても、元のLambdaと意味が違うものになります。

これはトランスパイラとしてかなり危険なので、今は変換を成功扱いにしない方針です。

実際の診断処理は、[互換性診断のテスト](https://github.com/mu7889yoon/stately.asl/blob/main/test/transpile/compatibility.test.ts)で確認できます。

## どのLambdaから移行するのがよさそうか

現時点で、statelyを使って移行候補にしやすいLambdaは次のようなものです。

### 1. AWS APIを数個呼ぶだけの運用Lambda

例えば、DynamoDBの状態を見て、別のDynamoDB操作やSQS送信を行うようなLambdaです。

コード量が少なくても、Lambdaとしてデプロイし続ける必要があります。

こういう「忘れたいけど、止めるわけにはいかないLambda」は、Step Functionsへ移す価値があります。

### 2. 分岐が増えて読みにくくなったLambda

`if/else`が増えたLambdaは、処理の全体像がコードのネストに埋もれがちです。

Step Functionsの`Choice`になれば、分岐そのものを実行履歴や可視化画面で確認できます。

もちろん、分岐の中身が複雑なデータ加工なら、その加工処理は別のLambdaやサービスに残すべきです。

### 3. fan-out処理をしているLambda

配列の各要素に対して同じAWS APIを呼び出す処理は、Mapへの移行候補です。

ただし、Mapにした結果として並列数が増えすぎる可能性があります。変換できることと、本番でそのまま使ってよいことは別問題です。

### 4. 外部APIを呼んでいるLambda

AWS APIの呼び出し後にWebhookを叩くような処理は、HTTP Taskとの相性がよさそうです。

Lambdaの実行時間やログを気にする代わりに、Step Functionsの状態として外部API呼び出しを管理できます。

ただし、認証情報やネットワーク要件は先に確認する必要があります。

## Lambdaを全部なくすためのものではない

ここは誤解されたくないところです。

statelyは、Lambdaを全部Step Functionsへ置き換えるためのツールではありません。

Step Functionsへ移したいのは、Lambdaの中にある**オーケストレーション**です。

一方で、次のような処理はLambdaや別の計算基盤に残した方がいいです。

- 複雑な文字列処理
- 大きなデータの変換
- 独自アルゴリズムによる計算
- 外部ライブラリを使った処理
- ドメインロジックが中心の処理

Step Functionsの状態を増やせば何でも表現できる、という考え方をすると、今度はステートマシン側が読みにくくなります。

「AWS APIを呼ぶ流れ」はStep Functionsへ。

「データを加工する処理」はLambdaへ。

このくらいの線引きが、今のstatelyには合っています。

## まとめ

- statelyは、TypeScript一般を変換するものではない
- `await`、`if/else`、`Promise.all`、`for...of`がAWS API呼び出しと組み合わさると変換しやすい
- AWS SDK呼び出しは`Task`、分岐は`Choice`、並列は`Parallel`、反復は`Map`になる
- `map`、`filter`、文字列加工、独自関数など、CPU上の処理は苦手
- `stately analyze`で、変換前に未対応構文を確認できる
- 狙い目は、忘れたいけど残り続けているオーケストレーション用Lambda

「LambdaをTypeScriptのままStep Functionsへ変換する」と言うと、かなり大きなことを言っているように見えます。

でも実際にやっていることは、Lambdaの中から**ワークフローとして切り出せる部分を見つける**ことです。

この境界線が、もう少し広がると嬉しいんですけどね。

まずは、AWS APIを呼ぶだけの小さなLambdaから試していくのがよさそうです。

ではでは〜
