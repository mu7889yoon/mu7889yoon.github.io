---
date: '2026-05-04T20:13:38+09:00'
draft: false
tags: ['tech', 'security','cicd', 'aws-labs']
description: '機密情報のコミットを防ぐためのgit-secretsについてご紹介します。'
title: 'git-secretsに触れて、シークレットの管理方法の再考をする'
---

よ〜んです

GitHub のリポジトリに AWS アクセスキーや API キーなどのシークレットを誤ってコミットしてしまう可能性ってありますよね。もちろんビューで気づけるのが理想ですけど、大AI時代となった今、人の目だけに頼る運用には限界があります。

コードレビュー以外の方法でシークレット混入を機械的に防げないかを調査して見ました。AWS Labs が公開している [git-secrets](https://github.com/awslabs/git-secrets) というツールを見つけたので、本記事ではそれを実際に触ってみようと思います。

## git-secretsとは

`git-secrets` は、シークレットや認証情報が Git リポジトリにコミットされることを防ぐためのツールです。AWS の [Prescriptive Guidance](https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/patterns/scan-git-repositories-for-sensitive-information-and-security-issues-by-using-git-secrets.html) でも、パスワードや AWS アクセスキーなどの機密情報を検出する用途で紹介されていたりします。

特に AWS を扱う場合は、認証情報パターン(ルールセット)を一括登録するコマンドも用意されています

```bash
git secrets --register-aws
```

## インストール

macOS なら Homebrew でサクッとインストール可能です：

```bash
brew install git-secrets
```

## リポジトリに設定する

ここが大事なんですけど、ツールをインストールしただけではまだ各リポジトリで動きません。

対象のリポジトリで以下を実行します

```bash
git secrets --install
git secrets --register-aws
```

`git-secrets` は Git hooks に依存しているので、ツールのインストール後に、リポジトリごとに hooks をセットアップする必要があります。

## 実際に試してみる

検証用にシークレットらしき値を含むファイルを作ってみます（もちろんダミーですよ！！！）

```bash
cat << 'EOF' > .env
AWS_ACCESS_KEY_ID=HOGEIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=fUgalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EOF
```

この状態でコミットしようとすると、`git-secrets` が検知して止めてくれます：

```bash
git add .env
git commit -m "add env file"
```

検知されると、対象ファイルの行番号や一致した内容が表示されて、コミントは失敗します。`Matched one or more prohibited patterns` が出力されます。

### 独自のパターンを追加する

AWS のアクセスキー以外にも、プロジェクト独自の命名規則や環境変数を検知したい場合があります。その場合は禁止パターンを追加できます：

```bash
git secrets --add 'MY_APP_SECRET'
git secrets --add 'PRIVATE_API_KEY'
git secrets --add 'PASSWORD='
```

こうすることで、自分たちで定義したパターンにも対応できるんですよ。チームやプロジェクトで「これはリポジトリに入れちゃダメ」と決めたものをルール化できるのは、めっちゃ便利です。

## そもそも論として

最近では `.env` にクレデンシャルを置く運用自体がベストプラクティスではないと考えます。

もちろんローカル開発で `.env` を使うこともありますけど、実環境へのクレデンシャルではなく、ローカル開発用DBの情報であったりを持たせているだけです。

たとえば GitHub Actions から AWS にアクセスする場合、長期的なアクセスキーを GitHub Secrets に保存するんじゃなくて、OIDC を使って一時的な認証情報を取得する流れが増えているんですし。AWS CodeBuild や CodePipeline を使う場合も、IAM ロールを使えば、アクセスキーをコードや設定ファイルに直接持たずに AWS にアクセスできます。

ローカル環境からのデプロイでも(やりたくないですが)、1Password のような シークレット管理ツールを使うことで、`.env` には本物のシークレットを置かないアプローチがあります。

つまり、理想は「漏えいしないように検知する」だけじゃなくて、そもそも「漏えいするようなシークレットをファイルで持たない」ことなんですよね。

## まとめ

AWS Labs の `git-secrets` を使ってシークレット混入を防ぐことを試してみました。結果として、AWS アクセスキーや自分たちで定義した禁止パターンに一致する文字列をコミット前に検知できることが分かりました。

`git-secrets` はシークレット管理をベストプラクティスに置き換えるものではありません。ですが、開発者が手元で早めにミスに気づくための仕組みとしては、導入する価値があると感じました。

シークレットをファイルとして持たない構成が理想ですけど、現実には `.env` や設定ファイルを扱う場面もまだあります。そのような環境では、`git-secrets` みたいなツール入れておくことで、防げる事故はかなり多いんじゃないでしょうか。

では〜ん
