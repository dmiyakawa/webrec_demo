# これは何

話している間だけ録音して、wavとして再生・保存可能にするデモ

https://mowa-net.jp/demos/webrec_demo/

## デモの利用方法

Webサイト上でのマイクの利用を許可し、日本語をしゃべる。
一度のおしゃべりは3秒〜1分

## 使用している技術

* getUserMedia
* Web Audio API
* Recorderjs (https://github.com/mattdiamond/Recorderjs)
  * Copyright © 2013 Matt Diamond

## 技術解説

約300ms間マイクで音を検出したら録音を開始し、約1500ms音が聞こえないようなら録音を止める。
それだけだと録音開始時点ですでに300ms分意味のある音を捨ててしまうため、
Recorderの手前に600msのDelayを入れることで適切な範囲を録音するようにしている。

## 関連プロジェクト

本プロジェクトを元に、Google Cloud Speech APIを用いて日本語のトランスクリプトも表示するデモを作った。

https://github.com/dmiyakawa/rec_and_translate_demo

## ライセンス

Apache-2.0


