---
date: '2026-07-31T20:11:07+09:00'
draft: false
tags: ['claude', 'claude managed agents']
description: 'Claude Community大阪のManaged Agentsワークショップに参加して、CMAで航空券検索エージェントやPPTX生成エージェントを作ってみた'
title: 'Claude Managed Agentsに触れてみた'
---

よ〜んです。

[Osaka | Claude Managed Agents Workshop](https://luma.com/claude-e5yf?tk=h2nrNG)に行ってきました！

今回のハンズオンは、[森田さん](https://x.com/moritalous)が公開されている次の資料をベースに進めました。

[Claude Managed Agents Workshop](https://moritalous.github.io/claude-managed-agents-workshop-202607/)

コンソールの画面操作からCLI、Python SDKを使った実装、PPTX生成やマルチエージェントなどの応用例まで、段階的にClaude Managed Agentsに触れれるワークショップとなっておりました！

## Claude Managed Agentsとは

Claude Managed Agents（以下CMA）は、Claudeを自律型エージェントとして実行するためのプラットフォームです。

AIエージェントを作る場合、単純にLLMのAPIを呼び出すだけでなく、ツールの実行環境やサンドボックス、状態管理、ログ基盤なども必要になると考えます。

既存のAgent SDKやサービスを使うことで実装はできますが、実行基盤の構築や運用などが残ります。

CMAでは、これらの基盤部分をAnthropicで管理してくれます。開発者が主に行うのは、エージェントをセットアップする、エージェントにメッセージを送るの2つです。

エージェントのプロンプトだけでなく、ツールを実際に動かす環境をAnthripic側でまとめて使えるのが良さそうですね。

**ただし、現時点でCMAはベータ版です。** 本番環境での利用を前提にする場合は、API仕様だけでなく、データの保持、権限管理、コスト、出力の再現性などを十分に確認する必要があります。

### エージェントのテンプレート

CMAには、最初から複数のテンプレートが用意されていました。

![](/images/019fc0c0-4cf5-7815-a99d-a7d9f9c2ae5c.png)

ゼロから設計しなくても、テンプレートをベースにカスタマイズして使い始められます。

### コスト

CMAの料金は、大きく次の2つに分かれています。

1. トークン
2. CMAの料金

トークンについては、エージェントが実際に動いている時間に対して、1時間あたり0.08ドルが発生します。実行時間はミリ秒単位で計測されます。

ユーザーからの入力を待っているアイドル時間は課金対象にならず、エージェントが実際に`running`状態になっている時間だけが対象です。

また、プロンプトキャッシングやコンテキストのコンパクションによる最適化は、CMA側に組み込まれているとのことです。

セッション料金だけを見るとかなり安く、実際の費用の中心はモデルが使用するトークンになりそうですね。

[Pricing - Claude Platform Docs](https://platform.claude.com/docs/en/about-claude/pricing#session-runtime)

## エージェントを作っていく

ここから、テンプレートを使わずにワークショップで作成したエージェントをベースに、オリジナルのエージェントを作ってみます。

### 日本国内の航空券を安い値段で探す君

まずは、日本国内の航空券を安い値段で探してくれるエージェントを作成します。入力したプロンプトは次のとおりです。

```text
日本国内の航空を安い値段で探したい。

- 出発地と目的地、いつ飛行機に乗るかを伝えます。
- ブラウザツールを使用し、航空券を探してください。
- それらの結果から、最も安いプランを教えてください。
- リンクと一緒に結果を教えてください。
```

あえて細かい条件は書いていません。雑な指示から、どこまで不足している情報を保管してくれるか見てみます。

#### 生成されたエージェントの設定

プロンプトを入力すると、「Japan Flight Deal Finder」というエージェントが生成されました。モデルにはclaude-sonnet-5が選択されています。

```yaml
name: Japan Flight Deal Finder
model:
  effort:
    type: high
  id: claude-sonnet-5
  speed: standard
description: 日本国内線の航空券を検索し、最安値のプランをリンク付きで提案するエージェント。
system: あなたは日本国内線の航空券を安く探す旅行アシスタントです。まずユーザーから出発地・目的地・搭乗希望日(時間帯があれば)を確認してください。次にweb_searchとweb_fetchツールを使い、ANA・JAL・Peach・Jetstar・Skyscanner・Google Flightsなど複数の航空会社・比較サイトの運賃を調べます。得られた候補を価格順に比較し、最も安いプランを中心に2〜3件を提示してください。回答には必ず「便名/航空会社・出発時刻・到着時刻・価格・予約ページへのリンク」を含めます。価格や空席状況は変動するため、確認した時点の目安である旨を明記してください。曖昧な条件は推測せず、必要な情報が不足している場合はユーザーに質問してください。
mcp_servers: []
tools:
  - configs: []
    default_config:
      enabled: true
      permission_policy:
        type: always_allow
    type: agent_toolset_20260401
skills: []
metadata: {}
```

生成されたコンフィグには、元の指示には書いていなかった次のような内容も追加されていました。

- 出発地、目的地、搭乗希望日を確認する
- 複数の航空会社や比較サイトを調査する
- 価格順で2〜3件を提示する
- 便名、時刻、価格、予約リンクを含める
- 不明な条件を勝手に推測しない

自然言語の指示をそのまま保存するだけではなく、ある程度実用的なシステムプロンプトに展開してくれるようです、素晴らしい。

設定はYAMLやJSONで確認でき、作成後に手動で編集することもできます。

#### 実際に動かしてみる

作成したエージェントに、次のように質問しました。

> 11/6に関西から秋田に行きたい！

かなり曖昧な依頼ですが、エージェントはすぐに検索を始めるのではなく、不足している条件を確認しようとしていました。

デバッグ画面では次のようなイベントを確認できました。

- 実行環境の作成
- セッションの開始
- モデルの呼び出し
- ツールの実行
- ツールの実行結果
- エージェントからの応答

結果が返ってきたことだけでなく、内部でエージェントがどのように動いているかをイベント単位で追えるのは便利ですね。

![](/images/019fc0c3-3b45-73b3-bb10-ddd9c28706c1.png)

### 日本国内の航空券のデータからPPTXを生成君

このエージェントは、ワークショップ資料の[分析レポートエージェント](https://moritalous.github.io/claude-managed-agents-workshop-202607/advanced/01_report/)の手順をベースに作成しています。

資料では、PPTX生成に必要な依存関係を持つ環境の作成から、エージェントの定義、セッションの実行、生成ファイルのダウンロードまで紹介されています。

#### 作成に利用したコード

##### `setup.py` - 環境作成

パワポ作成にあたり必要なパッケージやネットワークへの接続をここで指定していきます。

ほぼ[サンプルのコード](https://moritalous.github.io/claude-managed-agents-workshop-202607/advanced/01_report/#2-%E3%83%AA%E3%82%BD%E3%83%BC%E3%82%B9%E3%82%92%E4%BD%9C%E6%88%90)そのままです。

```python
from anthropic import Anthropic

client = Anthropic()

environment = client.beta.environments.create(
    name="Report-environment-adv",
    config={
        "type": "cloud",
        "packages": {
            "apt": ["libreoffice-impress", "poppler-utils", "fonts-noto-cjk"],
            "pip": ["markitdown[pptx]", "Pillow"],
            "npm": ["pptxgenjs"],
        },
        "networking": {"type": "unrestricted"},
    },
)
```

##### `setup.py` - 航空券検索エージェント

先ほど作成したエージェントのYAMLをベースに、Pythonで記述していきます。

```python
flight_agent = client.beta.agents.create(
    name="Japan Flight Deal Finder",
    model="claude-sonnet-5",
    description="日本国内線の航空券を検索し、最安値のプランをリンク付きで提案するエージェント。",
    system="あなたは日本国内線の航空券を安く探す旅行アシスタントです。まずユーザーから出発地・目的地・搭乗希望日(時間帯があれば)を確認してください。次にweb_searchとweb_fetchツールを使い、ANA・JAL・Peach・Jetstar・Skyscanner・Google Flightsなど複数の航空会社・比較サイトの運賃を調べます。得られた候補を価格順に比較し、最も安いプランを中心に2〜3件を提示してください。回答には必ず「便名/航空会社・出発時刻・到着時刻・価格・予約ページへのリンク」を含めます。価格や空席状況は変動するため、確認した時点の目安である旨を明記してください。曖昧な条件は推測せず、必要な情報が不足している場合はユーザーに質問してください。",
    tools=[
        {
            "type": "agent_toolset_20260401",
            "default_config": {
                "enabled": True,
                "permission_policy": {"type": "always_allow"},
            },
        }
    ],
)
```

##### `setup.py` - レポートエージェント

こちらもほぼ[サンプルのコード](https://moritalous.github.io/claude-managed-agents-workshop-202607/advanced/01_report/#2-%E3%83%AA%E3%82%BD%E3%83%BC%E3%82%B9%E3%82%92%E4%BD%9C%E6%88%90)そのままです。

```python
report_agent = client.beta.agents.create(
    name="Report Agent",
    model="claude-sonnet-5",
    description="データ分析とスライドレポート作成を行うエージェント。",
    system="あなたはデータ分析とレポート作成のアシスタントです。分析にはサンドボックスのbashとPythonを使い、スライドの作成にはpptxスキルに従ってください。成果物は必ず /mnt/session/outputs/ に保存してください。日本語で応答してください。",
    tools=[
        {
            "type": "agent_toolset_20260401",
            "default_config": {
                "enabled": True
            }
        }
    ],
    skills=[
        {
            "type": "anthropic", 
            "skill_id": "pptx"
        }
    ],
)
```

##### `setup.py` - オーケストレーションエージェント

航空券検索エージェントとレポートエージェントの取りまとめを行うエージェントです。

`multiagent`に、先ほど作成した航空券検索エージェントとレポートエージェントを指定します。

```python
coordinator = client.beta.agents.create(
    name="Flight Report Coordinator",
    model="claude-sonnet-5",
    description="航空券を検索し、その結果をpptxレポートにまとめるまでを取りまとめるエージェント。",
    system="あなたは旅行プラン作成のコーディネーターです。パラレルではなく、必ず次の順番でサブエージェントに依頼してください。1) ユーザーから出発地・目的地・搭乗希望日を確認する（不明な点はユーザーに質問する）。2) Japan Flight Deal Finder エージェントに、条件を伝えて日本国内線の最安プランを2〜3件調査してもらう。結果（航空会社/便名・出発到着時刻・価格・予約リンク）を受け取る。3) 受け取った調査結果をそのままReport Agentに渡し、タイトル・比較表・おすすめプランの解説の3枚程度の日本語pptxレポートを作成し、/mnt/session/outputs/ に保存するよう依頼する。4) 最後にユーザーへ、レポートを作成した旨と要点を日本語で報告する。各サブエージェントには、作業に必要な情報（出発地・目的地・日付・前段の調査結果など）を毎回明示的に伝えてください。サブエージェントは会話履歴を共有していません。",
    tools=[
        {
            "type": "agent_toolset_20260401",
            "default_config": {
                "enabled": True,
                "permission_policy": {
                    "type": "always_allow"
                },
            },
        }
    ],
    multiagent={
        "type": "coordinator",
        "agents": [
            flight_agent.id,
            report_agent.id,
        ],
    },
)
```

#### 実際に動かしてみる

> 関西の空港から秋田までの国内線の航空券を探してください。搭乗希望日は2026年11月6日、時間帯はこだわりません。最安値を中心に候補を調査したうえで、おすすめプランのPPTXレポートを作成して

ここまで言わなくてもレポート生成してくれそうな気がしますが、一応言っておきます。

サブエージェントを呼び出していることが確認できます。

![](/images/019fc0ce-b255-7f0a-97d0-5ff4561061bf.png)

完了したようです、レスポンスと生成されたスライドを確認します。

##### レスポンス

![](/images/019fc0cf-56b8-7fec-a4f5-61680961a1f6.png)

##### スライド

AIにスライドを作らせたことがなかったのですが、読みやすく、シンプルなデザインで出力されていてびっくりしました。

![](/images/019fc0d0-92de-7863-a5cd-4905c2391122.png)

![](/images/019fc0d0-b4b7-7b83-945c-c9f6a289939b.png)

![](/images/019fc0d0-c7eb-77bf-806e-c8d892ce0b9c.png)

## ワークショップを通じて

### 簡単に作れる

とにかくエージェントを作るまでが速い。

プロンプトを書く → 環境を選ぶ → 動かす。これだけで動くものができてしまいます。

「次はこういうのを作ったらどうなるんだろう」が止まらなくて、時間が全然足りませんでした。新しいおもちゃを手に入れた気分です。

### Anthropicのエコシステムが良い

CMAそのものだけでなく、周辺の開発体験がまとまっているのも良かったです。

例えば、CLIでは次のコマンドから認証できます。

```shell
ant auth login
```

APIキーをコピーして環境変数へ設定するだけではなく、ブラウザを使ったログインフローが用意されています。

### Jina AI

今回のワークショップの中で、[Jina AI](https://jina.ai/)というサービスを使いました

これまでは、AIエージェントにWeb検索機能を持たせるときは[Tavily](https://www.tavily.com/)を使うことが多かったのですが、Jina AIでもWeb検索やWebページの取得ができます。

特に良かったのが、会員登録なしでトライアル用のAPIキーを取得してすぐ試せました。

副次的に使ったことないサービスと出会えるのもいいですね。

## まとめ

CMAは、実行環境の定義、依存関係のインストール、セッション管理、ツール実行、デバッグ、などが一つのプラットフォームにまとまっていて、思いついたアイデアをすぐに試せる点が特に良かったです。

また、ワークショップの資料が段階的に構成されていたおかげで、コンソール操作からCLI、Python SDKを利用した実装まで迷わず進められました。

森田さん、ありがとうございました。

ではでは〜

## 追記①

お土産でClawdのぬいぐるみをいただきました！かわいい！

![](/images/019fc0dd-c6a5-73f7-a32c-2d2b4865c510.jpg)

## 追記②

森田さん、Claude Community Ambassadorおめでとうございます㊗️

<blockquote class="twitter-tweet" data-media-max-width="560"><p lang="ja" dir="ltr">本日よりClaude Community Ambassadorとしての活動をスタートします✨<br><br>大阪を盛り上げていくぞー🎇<br>ということでワークショップを企画しました🌈<br><br>7/31 19:00からです😎<a href="https://t.co/6mcxKfZSKg">https://t.co/6mcxKfZSKg</a></p>&mdash; moritalous | Kazuaki Morita (@moritalous) <a href="https://x.com/moritalous/status/2071904139387523264?ref_src=twsrc%5Etfw">June 30, 2026</a></blockquote> <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>
