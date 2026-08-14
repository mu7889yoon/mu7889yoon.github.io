---
date: '2026-08-14T14:05:12+09:00'
draft: false
tags: ['tech', 'tips', 'postman', 'spring-boot']
description: 'Postmanを使って、Spring Bootで作ったTodo APIをCollectionとCollection Runnerからテストしてみた記録です。'
title: 'PostmanのCollectionからTodo APIをテストしてみる'
---

よ〜んです。

前回、Spring BootでToDoアプリを作りました。次回はこれをPostmanからテストしてみる。と言っていたので、今回は初めてPostmanを触ってみます。

今まで使ったことがありません。APIにリクエストを送るGUI、ぐらいの理解です。

## Postmanをインストールする

今回はローカルのDockerで動かしているSpring Bootへアクセスするので、デスクトップアプリを使います。

Macなら、Homebrewでインストールできます。[公式のインストール手順](https://learning.postman.com/docs/getting-started/installation/install-app/)にもHomebrewの方法が載っています。

```shell
brew install --cask postman
```

Postmanを起動したら、アカウントを作成してログインしました。

## Collectionとは

[Collection](https://learning.postman.com/docs/use/send-requests/create-requests/intro-to-collections/)は、APIへ送るリクエストをまとめて保存しておく単位です。

今回のタスク管理APIでは、次のように分けました。

単発のリクエストを保存するだけではなく、リクエストごとにテストスクリプトも持たせられます。

例えばタスクを登録するリクエストでは、レスポンスが`201 Created`であることを確認し、返ってきたUUIDを`todoId`というCollection変数へ保存しています。

そのため、後続の「取得」「更新」「完了」「削除」では、毎回UUIDをコピーして貼り付ける必要がありません。

今回作成したCollectionは、[examplesリポジトリのPostmanディレクトリ](https://github.com/mu7889yoon/examples/tree/main/getting-started-with-spring-boot-and-cdkd/app/postman)に置いてあります。

## 認証もいい感じにできるらしい

Collectionを開くと、`Authorization`というタブがあります。

今回のTodo APIはまだ認証を実装していないため、`No auth configured`の状態で実行します。認証が必要なAPIでは、このタブからCollection全体、フォルダー単位、またはリクエスト単位で認証方式を設定できます。

![](/images/019fffd0-3900-7ba0-bcd0-b5b9939b980a.png)


Postmanでは、API Key、Basic Auth、Bearer Token、JWT、OAuth 2.0などを選べます。[公式ドキュメント](https://learning.postman.com/docs/use/send-requests/authorization/authorization-types/)を見ると、認証情報をヘッダーやクエリパラメータへ追加する方式も選択できるようです。

親のCollectionで認証を設定し、子のリクエストから`Inherit auth from parent`で引き継ぐこともできます。複数のリクエストに同じ認証情報を設定する場合に便利そうです。

ただし、APIキーやトークンをCollectionへそのまま書くのは避けたいところです。Postmanの変数やVaultに保存して、Collectionファイルを共有しても秘密情報が漏れないようにする必要があります。[認証情報の設定方法](https://learning.postman.com/docs/use/send-requests/authorization/specifying-authorization-details/)にも、変数を使って認証情報を再利用する方法が説明されています。

今回は認証なしで進めますが、次にSpring Securityなどで認証を追加したときは、ここでBearer Tokenを設定してテストすることになりそうです。

## Collectionを読み込む

作成したCollectionをPostmanにインポートします。

`baseUrl`はローカルの環境を指すように設定済みです。

## テストを実行していく
### まずは1件ずつ実行する

最初に`01 Health Check`を開き、`Spring Boot Is Running`の`Send`を押します。

![](/images/019fffe7-5ae0-78da-b5aa-fe9614ff6e83.png)

タスクの登録時に保存した`todoId`を、後続のリクエストで使い回す流れです。

レスポンスの`Test Results`または`Post-response`から、ステータスコードやレスポンスの内容を確認できます。

### Collection Runnerでまとめて実行する

![](/images/019fffd0-0250-7e92-9897-a045646a4261.png)

一つずつ`Send`することもできますが、Collectionのメニューから`Run collection`を選ぶと、複数のリクエストをまとめて実行できます。

![](/images/019fffd0-1da8-7637-abd0-471dc0359369.png)

Run typeに`Functional`と`Performance`がありますね

[Collection Runnerの公式ドキュメント](https://learning.postman.com/docs/tests-and-scripts/running-collections/intro-to-collection-runs/)によると、Collection Runnerはリクエストを指定した順番で実行し、各リクエストのテスト結果を記録してくれます。

実行すると、タスクの登録から削除までが自動で進み、各テストの成功・失敗が一覧で表示されました。

![Collection Runnerの実行結果](/images/019fffd0-5458-7ed4-a12a-86c9b7fa2d26.png)

エラー系のフォルダーも一緒に実行しているので、正常系だけを確認したい場合は、Collection Runnerで対象フォルダーを分けて実行できます。

### パフォーマンステストも試す

Collection Runnerには、ファンクショナルテストだけではなく、パフォーマンステストのタブもありました。

[公式ドキュメント](https://learning.postman.com/docs/tests-and-scripts/performance-testing/performance-test-configuration/)では、Collectionのリクエストを複数ユーザーの利用をシミュレーションしながら繰り返し実行する機能として説明されています。

![](/images/019fffe7-7638-7db8-94bf-4e376876cf0b.png)

実際に動かしてみると、エラー率がかなり高くなりました。

これはアプリケーションが急に壊れたわけではなく、今回のCollectionに「タイトルなしは400になる」「存在しないタスクは404になる」といったエラー系の検証も含めていたためです。

![](/images/019fffe7-4b40-7316-813b-ad88f21c9a58.png)


エラー系のリクエストを外してもう一度実行すると、先ほどより結果が見やすくなりました。

とはいえ、今回はローカルのDockerで動かしているだけなので、この結果を本番環境の性能値として見る意味はありません。あくまで、Collectionをそのまま負荷確認にも使えるんだな、という体験です。

## Mock Serverもあるらしい

今回は使っていませんが、PostmanにはMock Serverもあります。

保存したExampleをもとにレスポンスを返してくれるので、バックエンドがまだ実装中でも、フロントエンドからAPIを呼ぶ流れを先に確認できます。[Mock Serverの公式ドキュメント](https://learning.postman.com/docs/design-apis/mock-apis/mock-server-calls/)を読むと、リクエストのパスとHTTPメソッドに合うExampleを返す仕組みのようです。

ウォーターフォール開発で、事前にAPI仕様を決めていて、バックエンドとフロントエンドの担当が分かれている場合などに便利そうですね。

## まとめ

- PostmanのCollectionは、APIリクエストとテストをまとめて保存できる
- Collection変数を使うと、前のリクエストの結果を後続のリクエストへ渡せる
- Collection Runnerで、タスクの登録から削除までをまとめて実行できる
- 同じCollectionをファンクショナルテストやパフォーマンステストに使える
- CollectionはJSONファイルとして共有でき、将来的には[Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-collections/)や[Newman](https://learning.postman.com/docs/reference/newman-cli/installing-running-newman/)からCIで実行することもできる

おもろいですね、Postman。

GUIで手軽に試せる一方で、テストをCollectionとして残せるので、個人での確認からチームでの共有までつなげやすそうです。

次回は、フロントエンドをReactで作成していきます。
