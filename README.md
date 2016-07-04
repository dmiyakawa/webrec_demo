# これは何

話している間だけ録音して、wavとして再生・保存可能にするデモ

* WebRTC
* Web Audio API
* Recorderjs (https://github.com/mattdiamond/Recorderjs)
  * Copyright © 2013 Matt Diamond


## 技術解説

約300ms間マイクで音を検出したら録音を開始し、約1500ms音が聞こえないようなら録音を止める。
それだけだと録音開始時点ですでに300ms分意味のある音を捨ててしまうため、
Recorderの手前に600msのDelayを入れることで適切な範囲を録音するようにしている。

## ライセンス

Apache2

