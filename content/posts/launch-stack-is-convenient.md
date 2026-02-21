---
date: '2025-12-14T00:00:00+09:00'
draft: false
tags: ['tech', 'tips', 'aws', 'cloudformation']
description: '面倒な操作なくWebブラウザだけでCloudformationをデプロイする方法があったのでシェアします。'
title: 'CloudformationのLaunch Stackボタンが便利'
---

よ〜んです。

簡単なハンズオンや環境を渡したいときに、ローカルのマシンにコードを落としてもらうほどじゃないが、仕方なく落としてもらっているってことがあると思います。

私もその1人です（）

JAWS-UGなどのハンズオンで何度かこのLaunch Stackボタンにお世話になったことを思い出し、自分でも使えるのかな？と気になったため、触ってみました。

結論としては、とても簡単に作れましたので、サンプルのスタックとLaunch StackのURLの生成が簡単にできるシェルを描いてみました。

誰かのお役に立てれば幸いです。

| Launch Stackボタン | Region |
| :-: | :-: |
|[![Cloudformation Launch Stack button](https://cdn.rawgit.com/buildkite/cloudformation-launch-stack-button-svg/master/launch-stack.svg)](https://ap-northeast-3.console.aws.amazon.com/cloudformation/home?region=ap-northeast-3#/stacks/quickcreate?stackName=SampleStack&templateURL=https://publicbucketa6745c15-n3bqc2binchm.s3.ap-northeast-1.amazonaws.com/LambdaSample.json) | ap-northeast-3(大阪) |
|[![Cloudformation Launch Stack button](https://cdn.rawgit.com/buildkite/cloudformation-launch-stack-button-svg/master/launch-stack.svg)](https://ap-northeast-1.console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/quickcreate?stackName=SampleStack&templateURL=https://publicbucketa6745c15-n3bqc2binchm.s3.ap-northeast-1.amazonaws.com/LambdaSample.json) | ap-northeast-1(東京) |
|[![Cloudformation Launch Stack button](https://cdn.rawgit.com/buildkite/cloudformation-launch-stack-button-svg/master/launch-stack.svg)](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?stackName=SampleStack&templateURL=https://publicbucketa6745c15-n3bqc2binchm.s3.ap-northeast-1.amazonaws.com/LambdaSample.json) | us-east-1(バージニア北部) |

以下でLaunch StackのURLを生成できます。
`AWS_REGION`、`STACK_NAME`、`TEMPLATE_S3_URL`をいい感じに指定してください。

```bash
AWS_REGION=
STACK_NAME=
TEMPLATE_S3_URL=
echo "https://${AWS_REGION}.console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/quickcreate?stackName=${STACK_NAME}&templateURL=${TEMPLATE_S3_URL}"
```

ボタンはこちらからお借りしました。

[buildkite
cloudformation-launch-stack-button-svg](https://github.com/buildkite/cloudformation-launch-stack-button-svg)
