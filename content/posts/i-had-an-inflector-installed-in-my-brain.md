---
date: '2026-03-09T21:27:09+09:00'
draft: false
tags: ['tech', 'laravel', 'php']
description: 'Laravelの`artisan make:model -m`で生成されるマイグレーション名が、単に`s`を付加しただけではなく、規則変化や不規則変化、単複同形まで考慮して変換される仕組みを、深掘りしてみました。'
title: 'ワイ、脳にInflectorがインストールされてた...'
---

よ〜んです。

いきなりですが、Laravel の `artisan make:model` に以下のようなオプションを付けると、migration のコードも一気に作れます。

```bash
php artisan make:model Address -m
```

Model ができるのは理解できます。引数で `Address` を渡していますし

```bash
INFO  Model [app/Models/Address.php] created successfully.
```

でも migration はこうなります。

```bash
INFO  Migration [database/migrations/xxxx_xx_xx_xxxxxx_create_addresses_table.php] created successfully.
```

`addresses` になってる！？  
ありがたいけど、どうやて変換しているのでしょうか？

末尾に雑に `s` を付けているだけなのか、ちゃんと辞書やルールを持っているのか、気になったので検証した後に実装を深掘りしていきます。

## 検証（いじわる）してみる

もし Laravel が末尾にただ `s` を付けているだけなら、不規則変化や単複同形で崩れるはずです。
なので、いじわるな単語を何個か試してみました。

### 規則的（`+ves`）

#### Knife（ナイフ） → Knives

```bash
php artisan make:model Knife -m

INFO  Model [app/Models/Knife.php] created successfully.

INFO  Migration [database/migrations/xxxx_xx_xx_xxxxxx_create_knives_table.php] created successfully.
```

`knifes` ではなく `knives` になっています。  
えらい。思ったより英語ができる。

### 不規則

#### Child（子供） → Children

```bash
php artisan make:model Child -m

INFO  Model [app/Models/Child.php] created successfully.

INFO  Migration [database/migrations/xxxx_xx_xx_xxxxxx_create_children_table.php] created successfully.
```

#### Mouse（ねずみ） → Mice

```bash
php artisan make:model Mouse -m

INFO  Model [app/Models/Mouse.php] created successfully.

INFO  Migration [database/migrations/xxxx_xx_xx_xxxxxx_create_mice_table.php] created successfully.
```

#### Man（おとこ） → Men

```bash
php artisan make:model Man -m

INFO  Model [app/Models/Man.php] created successfully.

INFO  Migration [database/migrations/xxxx_xx_xx_xxxxxx_create_men_table.php] created successfully.
```

ここまで来ると、さすがに末尾 `s` 追加だけでは説明できません。  
Laravel、英語の授業をちゃんと受けています。

### 単複同形

#### Fish（さかな） → Fish

```bash
php artisan make:model Fish -m

INFO  Model [app/Models/Fish.php] created successfully.

INFO  Migration [database/migrations/xxxx_xx_xx_xxxxxx_create_fish_table.php] created successfully.
```

`fishes` ではなく `fish` のままでした。  
単複同形まで見ているなら、かなり本格的です。

## 実装を追ってみる

調べると、複数形変換のルールは [doctrine inflector](https://github.com/doctrine/inflector/blob/5256968fb7676c6717733920d6e9407e8145982d/src/Rules/English/Inflectible.php)の英語ルールに乗っていました。

中を見ていくと、雑に `s` を付けているのではなく、かなりちゃんとしています。

- [src/Rules/English/Inflectible.php](https://github.com/doctrine/inflector/blob/5256968fb7676c6717733920d6e9407e8145982d/src/Rules/English/Inflectible.php)
  - 規則変化や不規則変化をパターンマッチで処理している
- [src/Rules/English/Uninflected.php](https://github.com/doctrine/inflector/blob/5256968fb7676c6717733920d6e9407e8145982d/src/Rules/English/Uninflected.php)
  - `fish` のような単複同形を持っている

つまり Laravel は、英単語の末尾に `s` を足しているだけではなく、英語の複数形変換用のルールセットを使ってテーブル名を作っていました。

`Address -> addresses` ぐらいならまだしも、`Knife -> Knives` や `Mouse -> Mice` まで変換してくれるとは思っていませんでしたね。

---

## 俺、Inflectorがインストールされてる脳だった

Laravel の複数形変換を見ていて昔の記憶が蘇りました。

英語で、単数形から複数形への変換（？？？）を習うじゃないですか。 自分はアレを暗記してなかったなぁなどと思い出しました。（覚える気もなかった）

なので、まさに`doctrine inflector`のような処理フローを作っていましたね。

今思うと、英語の勉強というよりルールエンジンの設計でした。

## まとめ

`artisan make:model -m` で migration 名が複数形になるのは、ただ末尾に `s` を足しているからではありませんでした。

- `Knife -> Knives`
- `Child -> Children`
- `Mouse -> Mice`
- `Fish -> Fish`

こういうところまでちゃんと吸収してくれているライブラリやフレームワークの開発者の皆さんには感謝です。

あと、今回ドキュメントを読んでいて `urlize` も見つけました。  
今まで

```bash
hugo new content/posts/???.md
```

を叩く時、空白を消して `-` に置き換えて、みたいなことを手でやっていたんですが、使えそうだな〜とか思いました。

お
　し
　　ま
　　　い
