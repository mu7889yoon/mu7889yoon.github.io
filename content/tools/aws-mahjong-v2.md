---
title: "AWS麻雀 v2.0.0-beta"
---

## 麻雀の流れ

## AWS麻雀ルール

## AWS麻雀牌
### 萬子

コンピューティングとサーバレス

<div id="manzu"></div>

### 筒子

ネットワークとDevTools

<div id="pinzu"></div>

### 索子

ストレージとAI/MLとデータベース

<div id="souzu"></div>

### 字牌

リージョンなど

<div id="jihai"></div>

## AWS役 一覧

### 1翻役

#### 静的サイトホスティング(CDP)

面前のみ

<div id="static-site-hosting"></div>

#### サーバレスAPI

面前のみ

<div id="serverless-api"></div>

#### イベントドリブンアーキテクチャ

面前のみ

<div id="event-driven-architecture"></div>

#### Webアプリケーション(CDP)

EC2、ECSどちらでも良い

面前のみ

<div id="web-application1"></div>
<div id="web-application2"></div>

#### インメモリーキャッシュ(CDP)

EC2、ECSどちらでも良い

面前のみ

<div id="in-memory-cache1"></div>
<div id="in-memory-cache2"></div>

#### バッチ

面前のみ

<div id="batch"></div>

#### マイグレーション(CDP)

面前のみ

<div id="migration"></div>

### 2翻役

#### CI/CDパイプライン

他のAWS役があることで成立する特殊役

鳴く(チー)と1翻

<div id="cicd-pipeline"></div>

#### RAGエージェント

鳴く(チー)と1翻

<div id="rag-agent"></div>

#### マスター・レプリカ構成

鳴く(ポン)と1翻

<div id="master-replica"></div>

#### ジョブオブザーバー(CDP)

面前のみ

<div id="job-observer"></div>

### 3翻役

#### CI/CDカン

他のAWS役があることで成立する特殊役

明カンの場合2翻

<div id="cicd-pipeline-kan"></div>

#### Webアプリケーションカン

明カンの場合2翻

<div id="web-application-kan1"></div>
<div id="web-application-kan2"></div>

#### ブルー・グリーンデプロイカン

明カンの場合2翻

<div id="blue-green-deploy-kan"></div>

#### AWS一盃口(冗長化)

同じAWS役が2つ揃った時に成立、通常の一盃口とは複合しない

鳴きナシ

以下の場合は**Webアプリケーション(CDP)**が2つとAWS一盃口で5翻となる

<div id="redundancy"></div>

#### AWS三暗刻(3AZ構成)

同じAWS役が3つ揃った時に成立、通常の三暗刻とは複合しない

鳴きナシ

以下の場合は**Webアプリケーション(CDP)**が3つとAWS三暗刻で6翻となる

上がる際はどちらの形状で牌を晒して良い。

<div id="aws-three-concealed-triples1"></div>
<div id="aws-three-concealed-triples2"></div>

#### サーバーレスエスプレッソ

鳴きナシ、複合なし

<div id="serverless-espresso"></div>

### 役満

#### DRアーキテクチャ(役満)

七対子の亜種

面前のみ、複合なし

<div id="dr-architecture1"></div>
<div id="dr-architecture2"></div>

#### AWS緑一色

鳴きあり、複合なし

以下の牌で作られた3面子1雀頭であればOK

<div id="aws-all-green-tiles"></div>
<div id="aws-all-green"></div>

## 通常役
### 1翻役
#### 風






## 麻雀役一覧

https://mj-king.net/yaku/

### 1翻役
#### 平和（ピンフ）

#### 断么九(タンヤオチュウ)

#### 海底摸月（ハイテイツモ）

#### 河底撈魚（ホウテイロン）

#### 嶺上開花（リンシャンカイホー）

#### 搶槓（チャンカン）

#### 一盃口(イーペイコー)

### 2翻役
#### 対々和（トイトイホー）

#### 混老頭

#### 三暗刻

#### 三色同刻

#### 三色同順

#### 小三元

#### 一気通貫

#### 三槓子

#### 混全帯ヤオ九（チャンタ）

#### 七対子

### 3翻役

#### 混一色

#### 純全帯ヤオ九（ジュンチャン）

#### 二盃口

### 6翻役
#### 清一色

### 役満
#### 天和
#### 地和
#### 大三元
#### 四喜和
#### 字一色
#### 清老頭
#### 四暗刻
#### 国士無双
#### 九蓮宝燈
#### 四槓子


<script type="module">
    import { merjongAPI } from "/aws-mahjong-v2/customizable-merjong/packages/merjong-js/dist/merjong.js";

    const customTheme = {
        baseUrl: "/aws-mahjong-v2/output/",
        tileDesigns: {
            "0m": "5m.svg", "1m": "1m.svg", "2m": "2m.svg", "3m": "3m.svg", "4m": "4m.svg",
            "5m": "5m.svg", "6m": "6m.svg", "7m": "7m.svg", "8m": "8m.svg", "9m": "9m.svg",
            "0p": "5p.svg", "1p": "1p.svg", "2p": "2p.svg", "3p": "3p.svg", "4p": "4p.svg",
            "5p": "5p.svg", "6p": "6p.svg", "7p": "7p.svg", "8p": "8p.svg", "9p": "9p.svg",
            "0s": "5s.svg", "1s": "1s.svg", "2s": "2s.svg", "3s": "3s.svg", "4s": "4s.svg",
            "5s": "5s.svg", "6s": "6s.svg", "7s": "7s.svg", "8s": "8s.svg", "9s": "9s.svg",
            "1z": "1z.svg", "2z": "2z.svg", "3z": "3z.svg", "4z": "4z.svg",
            "5z": "5z.svg", "6z": "6z.svg", "7z": "7z.svg"
        }
    };

    const renderInto = (id, mpsz) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = merjongAPI.render(mpsz, customTheme);
    };

    // 牌一覧
    renderInto("manzu", "123456789m");
    renderInto("pinzu", "123456789p");
    renderInto("souzu", "123456789s");
    renderInto("jihai", "1234567z");

    // 役一覧
    const yakuSamples = [
        { id: "static-site-hosting", mpsz: "54p3s" },
        { id: "serverless-api", mpsz: "2p1m8s" },
        { id: "event-driven-architecture", mpsz: "8m1m8s" },
        { id: "cicd-pipeline", mpsz: "789p-qqq" },
        { id: "cicd-pipeline-kan", mpsz: "6789p-qqq" },
        { id: "dr-architecture1", mpsz: "55p-11z-22z-33p-22m-77s-33s" },
        { id: "dr-architecture2", mpsz: "55p-33z-44z-33p-33m-77s-22s" },
        { id: "web-application1", mpsz: "3p2m7s" },
        { id: "web-application2", mpsz: "3p3m7s" },
        { id: "web-application-kan1", mpsz: "3p2m7s9s" },
        { id: "web-application-kan2", mpsz: "3p3m7s9s" },
        { id: "in-memory-cache1", mpsz: "2m7s9s" },
        { id: "in-memory-cache2", mpsz: "3m7s9s" },
        { id: "rag-agent", mpsz: "345s" },
        { id: "master-replica", mpsz: "888s" },
        { id: "job-observer", mpsz: "9m4m2m" },
        { id: "blue-green-deploy-kan", mpsz: "5p36m7s" },
        { id: "redundancy", mpsz: "3p2m7s-3p2m7s" },
        { id: "batch", mpsz: "865m" },
        { id: "migration", mpsz: "1p7s2m" },
        { id: "aws-three-concealed-triples1", mpsz: "3p2m7s-3p2m7s-3p2m7s" },
        { id: "aws-three-concealed-triples2", mpsz: "333p-222m-777s" },
        { id: "serverless-espresso", mpsz: "2p7m1m8m7m1m"},
        { id: "aws-all-green", mpsz: "123s-123s-444s-666s-66s" },
        { id: "aws-all-green-tiles", mpsz: "1s-2s-3s-4s-5s-6s-6z" },        
    ];

    yakuSamples.forEach(({ id, mpsz }) => renderInto(id, mpsz));
</script>
