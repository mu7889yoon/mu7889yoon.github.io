---
date: '2026-09-10T23:33:49+09:00'
draft: false
tags: ['tech', 'm5stack']
description: 'M5Stack Cardputer-ADVを触ってみました。UIFlow2とMicroPythonを使って、環境の切り替えからLCDへのHello World表示までを試します。Cardputer-ADVを初めて触る人向けの入門記事です。'
title: 'Cardputer-ADVが来たので、MicroPythonでHello Worldしてみる'
---

よ〜んです。

Cardputer-ADVをいただきました。

![](/images/01a0941a-4628-78a6-9e66-540c2e7cde11.jpg)

キーボード付きで、ディスプレイやmicroSD、赤外線なども付いている小さなデバイスです。こういうガジェットはいつの世もワクワクさせてくれますね。

## Cardputer-Adv とは

M5Stack のCardputerの改良版らしいです。

名刺サイズの筐体に ESP32-S3、キーボード、液晶、Wi-Fi/BLE、バッテリーなどを詰め込んだ小型コンピュータです。

いろいろな機能がまとまっていて、最初から色々試せるようになっています。

![](/images/01a0941a-55c8-7791-840a-bd4c48e3fd6b.jpg)

## UIFlow2 に変更する

今回はMicroPythonを使ってプログラムを書くため、UIFlow2のランチャーに変更しました。

![](/images/01a0941a-2300-7b5b-b8b6-3ad07a487dfb.jpg)

## Hello World

ということで、Hello Worldするコードです。

```python
import M5


BLACK = 0x000000
WHITE = 0xFFFFFF
MESSAGE = "helloworld"

lcd = M5.Lcd
lcd.fillScreen(BLACK)
lcd.setTextSize(3)
lcd.setTextColor(WHITE, BLACK)

x = (lcd.width() - lcd.textWidth(MESSAGE)) // 2
y = (lcd.height() - 24) // 2
lcd.drawString(MESSAGE, x, y)
```

Cardputerの画面は、ターミナルのように文字を自動で並べて表示するものではなく、LCDに対して文字や図形を描画していく形になっています。

今回は helloworld を画面中央に表示したかったため、文字サイズを指定したうえで、画面サイズと文字列の幅から描画位置を計算しています。

![](/images/01a0941a-3688-7558-927f-d469c910f5b2.jpg)

## まとめ

M5Stack Cardputer-Advを触ってみました！

これから、このデバイスでいろいろ遊んでいきます。ただ、まだまだアイデア不足なんですよね…。
「Cardputerでこれを作ってみてほしい」みたいなアイデアがあれば、ぜひXなどでつぶやいてください。

ではでは〜
