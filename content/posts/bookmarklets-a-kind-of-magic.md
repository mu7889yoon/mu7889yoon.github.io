---
date: '2026-04-07T21:49:15+09:00'
draft: false
tags: ['tech', 'javascript', 'bookmarklet', 'browser']
description: 'ブックマークレットって、JavaScript をブックマークに登録して使う便利な魔法みたいなものについて（適当）ちょっとした作業を自動化とかに便利'
title: 'ブックマークレットとかいう魔法'
---
よ〜んです。

ブックマークレット、知ってます？ 拡張機能とかが当たり前になった今だと、名前すら聞いたことない人もいるかもしれないですね。枯れてるっちゃ枯れてるんですが、現役で使えるやつなんですよね

## ブックマークレット

ブックマークレットは、JavaScript をブックマークとして登録して使うやつです。

ブックマークを押すと、そのページで簡単な処理を実行できます。

拡張機能を入れるほどでもないけど〜みたいな時にちょうどいいやつです。

[ブックマークレット - Wikipedia](https://ja.wikipedia.org/wiki/%E3%83%96%E3%83%83%E3%82%AF%E3%83%9E%E3%83%BC%E3%82%AF%E3%83%AC%E3%83%83%E3%83%88)

## 最近(ここ3年ぐらい)で作ったブックマークレット

### ECS Execするためのやつ

cloudshellなどからecs execするために、以下のようなコマンドを組み立てる必要がありました。（過去形）

```sh
aws ecs execute-command --cluster ${CLUSTER_NAME} \
 --task ${TASK_ID} \
 --container ${CONTAINER_NAME}
 --interactive --command '/bin/sh'
```

ECSのタスク詳細ページで実行すると、URL からクラスター名・タスクID・コンテナ名を抜き出して `aws ecs execute-command` のコマンドを組み立てて、クリップボードにコピーしてくれます。あとは CloudShell に貼るだけ。

```js
javascript:(() => {
  const url = new URL(location.href);
  const segments = url.pathname.split("/");
  const cluster = segments[segments.indexOf("clusters") + 1];
  const task = segments[segments.indexOf("tasks") + 1];
  const container = url.searchParams.get("selectedContainer") || "web";

  const cmd = `aws ecs execute-command --cluster ${cluster} --task ${task} --container ${container} --interactive --command '/bin/sh'`;

  navigator.clipboard.writeText(cmd);
})();
```

今はマネージドコンソールからできます😢

[ECS Exec が AWS マネジメントコンソールで利用可能に - AWS](https://aws.amazon.com/jp/about-aws/whats-new/2025/09/ecs-exec-aws-management-console/)

### Markdownでリンク埋め込むやつ

引用する際に、こういう形式↓でクリップボードに入れてくれます。

[よ〜んの雑記](https://mu7889yoon.github.io/)

こういうの(レンダリング前)↓

```markdown
[よ〜んの雑記](https://mu7889yoon.github.io/)`
```

やっていることは単純で、`[title](url)` の形をそのままクリップボードに入れるだけです。

```javascript
javascript:(async () => {
  const title = document.title.replace(/\s+/g, " ").trim();
  const url = location.href;
  await navigator.clipboard.writeText(`[${title}](${url})`);
})();
```

### Webアプリを別ウィンドウで起動

```js
javascript:(() => {
  window.open(
    'https://discord.com/channels/@me',
    null,
    'width=500,toolbar=yes,menubar=yes,scrollbars=yes'
  );
})();
```

`window.open` でURLを小さめのウィンドウで開くだけです。Discord とか Slack とか、ブラウザのタブに埋もれさせたくないWebアプリを別窓で出すのに使ってます。PWA にするほどでもないけど、タブは分けたいときにちょうどいい。

### Gemini Nano でページを1行要約

```js
javascript:(async () => {
  const session = await LanguageModel.create();
  const title = document.title;
  const url = location.href;
  const text = (document.body?.innerText || "").trim().slice(0, 6000);

  const summary = await session.prompt(
    `次のページの内容を日本語で1文だけ要約してください。\n\nタイトル: ${title}\nURL: ${url}\n本文:\n${text}`
  );

  const md = `[${title}](${url}) - ${summary}`;
  await navigator.clipboard.writeText(md);
})();
```

### 参加してる勉強会の予定をダウンロード

connpass の参加イベント一覧ページで実行すると、表示されているイベントの `.ics` ファイルをまとめてダウンロードしてくれます。Google カレンダーにまとめて突っ込みたいときに便利。

```js
javascript:(async () => {
  const anchors = [...document.querySelectorAll("a.url.summary")];
  if (!anchors.length) return;

  const targets = [...new Set(
    anchors
      .map(a => a.href.match(/\/event\/(\d+)\/?$/)?.[1])
      .filter(Boolean)
  )];

  for (const id of targets) {
    const res = await fetch(
      `https://connpass.com/event/${id}.ics`,
      { credentials: "omit" }
    );
    if (!res.ok) continue;

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `connpass-event-${id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
  }
})();
```

載せてるのは当たり障りのないやつだけです。本当に便利なやつは…まあ、察してください。

## ちょっとだけ気をつけること

ブックマークレットから外部にリクエストを飛ばすケースでは、そのサイトに Service Worker が登録されていると [`fetch` イベントでリクエストを傍受できる](https://blog.sasakiy84.net/articles/bookmarklet-report2024/#service-worker-%E3%81%A7%E3%83%AA%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%81%8C%E8%A6%8B%E3%82%89%E3%82%8C%E3%81%A6%E3%81%97%E3%81%BE%E3%81%86%E5%8F%AF%E8%83%BD%E6%80%A7%E3%81%8C%E3%81%82%E3%82%8B)ので、Authorization ヘッダー付きの `fetch()` なんかは中身を見られる可能性があります。ページ内の情報だけで完結するやつなら問題ないですが、頭の片隅には置いておくとよさそうです。

## まとめ

ブックマークレットは自分にとってハッカー（ものを工夫して使い倒す人）への入り口でした。

中学生の頃は [Kick Ass](https://kickassapp.com/) でページを破壊して遊んで、高校・大学では~~クソ~~ちょっと使いにくいポータルサイトへのログインを自動化して、今は仕事で ECS Exec のコマンドを組み立てたりしてる。

やってることのレベルは変わりましたが、**ブラウザ上でちょっとしたことを動かす**楽しさは変わってないですね。

ブックマークレットは拡張機能ほど大げさじゃないし、思いついたらすぐ試せる。ブラウザさえあれば動くので、スマホでもパソコンでも同じブックマークレットがそのまま使えます。可搬性えらい。

ではでは
