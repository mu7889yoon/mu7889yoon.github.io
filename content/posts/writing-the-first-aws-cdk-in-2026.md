+++
date = '2026-01-02T23:47:32+09:00'
draft = false
tags = ['tips', 'tech', 'cdk', 'iac', 'cloudformation', 'terraform', 'cf2tf']
description = 'AWS CDKで作ったCloudFormationをcf2tfでTerraformへ変換してみた記録。'
title = '書き初めでAWS CDK書いてcf2tf使ってTerraformに変換したかった'
+++

よ〜んです、書き初めをします。

書き初めと言っても、習字ではなくAWS CDK書き初めをします。

本記事ではまず、AWS CDKで書き初めを行い、その後`cf2tf`というツールを使ってTerraformに変換してTerraform入門してみようと思います。

## cf2tf

正式名称[Cloudformation 2 Terraform](https://github.com/DontShaveTheYak/cf2tf)

名前の通り、AWS CloudFormationをTerraformに変換することを**試みる**ツール。

プロジェクトのREADMEにもある通り、**100% の精度で変換することは不可能だから**だそうです。

## 書き初め

`ApplicationLoadBalancedFargateService`で、~~ケチケチ構成の~~シンプルなECSを作成します。

そういえばL3コンストラクト使って書くこと自体、初めてな気がします。

```ts
import * as cdk from 'aws-cdk-lib/core'
import { Construct } from 'constructs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export class Cf2TfStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'EcsService', {
      cluster: new ecs.Cluster(this, 'Cluster', {
        vpc: new ec2.Vpc(this, 'Vpc', {
          maxAzs: 2,
          natGateways: 1,
        })
      }),
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      },
    })
  }
}
```

デプロイ完了しました、書き初めにもってこいですね

![](/images/019b7f5e-4fcb-7d24-aa80-d2c642c5f274.png)

PHPのバージョンめちゃくちゃ古いw

## Terraformへ入門してみる

今回はスタック名が`Cf2TfStack`なので、デプロイが完了すると`cdk.out/Cf2TfStack.template.json`が生成されます。

```sh
cf2tf cdk.out/Cf2TfStack.template.json > Cf2Tf.tf
```

こちらで、Terraformへの変換を試してくれます。

```terraform
resource "aws_subnet" "vpc_public_subnet1_subnet5_c2_d37_c4" {
  availability_zone = element(// Unable to resolve Fn::GetAZs with value: "" because cannot access local variable 'az_data' where it is not associated with a value, 0)
  cidr_block = "10.0.0.0/18"
  map_public_ip_on_launch = true
  vpc_id = aws_vpc.vpc8378_eb38.arn
  tags = {
    aws-cdk:subnet-name = "Public"
    aws-cdk:subnet-type = "Public"
    Name = "Cf2TfStack/Vpc/PublicSubnet1"
  }
}
```

Terraformのコードが生成されましたが、ところどころ解決できていないところがあります。

どうやらCloudFormationの組み込み関数[Fn\:\:GetAZs](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getavailabilityzones.html)をいい感じに処理できないようです。

他にも

- `AWS::ElasticLoadBalancingV2::LoadBalancer` → `aws_elasticsearch_domain_policy`
- `AWS::EC2::VPCGatewayAttachment` → `aws_vpn_gateway_attachment`

とマッチしていたりしました、なので`terraform validate`はもちろんコケます。

一旦、terraformに入門することは諦めて、`cf2tf`を触り尽くします。

```sh
mkdir Cf2Tf-tf
cf2tf cdk.out/Cf2TfStack.template.json -o Cf2Tf-tf
```

`-o`で出力するディレクトリを指定すると、いい感じにファイルを分割してくれます。

```sh
ls Cf2Tf-tf
data.tf         locals.tf       output.tf       resource.tf     variable.tfls 
```

Terraformはこんな感じで分割するのがお作法なのでしょうか(？)

## まとめ

### cf2tf

少し複雑なパターンで試してしまったことを反省、もっと簡単なパターンで試すべきでしたね。

実際に、CloudFormationからTerraformへ移行する際は、`cf2tf`を使って大まかに変換後、あとは`terraform plan`の結果から手動で調整していくのが良いのかなと思っていたり。

`cf2tf`はコントリビューションを受け付けていそうなので、直せそうならPR投げていきたいです。

### Terraform入門

Terraformの入門については入門できてないので、近道せずにじっくり学んでいこうと思います。

ではでは
