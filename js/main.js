window.URL = window.URL || window.webkitURL;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || 
                         navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var now = window.performance && (
    performance.now || performance.mozNow || performance.msNow ||
    performance.oNow || performance.webkitNow
);

window.getTime = function() {
  return (now && now.call(performance)) ||
    (new Date().getTime());
}

window.requestAnimationFrame = (function() {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    function(f) { return window.setTimeout(f, 1000 / 60); };
}());

window.cancelAnimationFrame = (function() {
  return window.cancelAnimationFrame ||
    window.cancelRequestAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.webkitCancelRequestAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.mozCancelRequestAnimationFrame ||
    window.msCancelAnimationFrame ||
    window.msCancelRequestAnimationFrame ||
    window.oCancelAnimationFrame ||
    window.oCancelRequestAnimationFrame ||
    function(id) { window.clearTimeout(id); };
}());

var Main = (function() {
  var MAX_RECORD_TIME_MILLIS = 60 * 1000;
  var INTERVAL_MILLIS = 100;
  var MAX_LOUDNESS_COUNTER = 3;
  var MAX_SILENCE_COUNTER = 10;

  var intervalId = null;
  
  var visualCanvas = null;
  var visualContext = null;
  
  var audioContext = null;
  var analyser = null;
  var delay = null
  var recorder = null;
  var isRecording = false;
  
  var timerRequestId = null;
  var recordedTimeMillis = 0;
  var previousTimeMillis = 0;

  var loudnessCounter = 0;
  var silenceCounter = 0;
  
  function init() {
    console.log("init()");
  
    audioContext = new AudioContext();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
  
    delay = audioContext.createDelay()
  
    visualCanvas = document.getElementById('visual');
    visualContext = visualCanvas.getContext('2d');
  
    if (!navigator.getUserMedia) {
      alert("WebRTC(getUserMedia) is not supported.");
      return;
    }
  
    navigator.getUserMedia({video: false, audio: true}, function(stream) {
      var input = audioContext.createMediaStreamSource(stream);
  
      input.connect(analyser)
      startInterval();
  
      // 600ms 遅延状態で録音する
      delay.delayTime.value = 0.6;
      input.connect(delay);
      recorder = new Recorder(delay, { workerPath: 'js/recorderjs/recorderWorker.js' });
      if (!recorder) {
        alert("Failed to create Recorder object");
      }
    }, function() {
      alert("getUserMedia() failed");
    });
  }
  
  
  function onInterval() {
    if (!analyser) {
      return;
    }
  
    visualContext.fillStyle = "rgb(0,0,0)";
    visualContext.fillRect(0, 0, analyser.fftSize, 256);
  
    var data = new Uint8Array(256);
    analyser.getByteTimeDomainData(data);
    // 絶対値を加算してしきい値を設定する
    // (音声解析的に正確な処理ではない。多分)
    var accum = 0;
    for (var i = 0; i < 256; ++i) {
      visualContext.fillStyle = "rgb(0,255,0)"
      visualContext.fillRect(i, 256 - data[i], 1, 2);
      // 128 ... 何も音がないとき
      accum += Math.abs(data[i] - 128);
    }
    if (isRecording) {
      if (accum > 1000) {
        // うるさくなったらカウンタはリセット
        silenceCounter = 0;
      } else {
        silenceCounter++;
        if (silenceCounter >= MAX_SILENCE_COUNTER) {
          stopRecordingWithExport();
          loudnessCounter = 0;
        }
      }
    } else {
      if (accum > 1000) {
        loudnessCounter += 1;
        if (loudnessCounter >= MAX_LOUDNESS_COUNTER) {
          startRecording();
          silenceCounter = 0;
        }
      } else {
        // 静かになったらリセット
        loudnessCounter = 0;
      }
    }
  }
  
  function startInterval() {
    if (intervalId) {
      console.warn("startInterval() ignored; intervalId already exists(" + intervalId + ")");
      return;
    }
    console.log("startInterval()");
  
    intervalId = setInterval(onInterval, INTERVAL_MILLIS);
  }
  
  function stopInterval() {
    if (!intervalId) {
      console.warn("stopInterval() ignored; no intervalId available.");
      return;
    }
    console.log("stopInterval()");
  
    clearInterval(intervalId);
    intervalId = null;
  }
  
  function startRecording() {
    if (isRecording) {
      console.warn("startRecording() ignored; already started recording.");
      return;
    }
    console.log("startRecording()");
    
    isRecording = true;
    startRecordTimer();
    
    recorder.record();
  }

  function stopRecording() {
    if (!isRecording) {
      console.warn("stopRecording() ignored; recording not started yet")
      return;
    }
    console.log("stopRecording()");
  
    stopRecordTimer();
    isRecording = false;
  
    recorder.stop();
  }

  function stopRecordingWithExport() {
    stopRecording();
    recorder.exportWAV(onWavExported);
  }
  
  function onWavExported(blob) {
    console.log("onWavExported()");
    var url = URL.createObjectURL(blob);
    var date = new Date();
    var fname =  date.toISOString() + '.wav';
  
    $('#timeline').append(
      '<li>'
      + fname
      + ' <a onclick="Main.playWavBlob(\'' + url + '\');"><span class="glyphicon glyphicon-play"></span></a>'
      + ' <a href="' + url + '" download="' + fname + '"><span class="glyphicon glyphicon-save"></span></a>'
      + '</li>');
  
    resetRecordTimer();
    recorder.clear();
  }
  
  function playWavBlob(url) {
    console.log("playWavBlob(" + url + ")");
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
  
    request.onload = function() {
      audioContext.decodeAudioData(request.response, function(buffer) {
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
      });
    }
    request.send();
  }
  
  function startRecordTimer() {
    previousTimeMillis = getTime();
    handleRecordTimer();
  }
  
  function handleRecordTimer() {
    var now = getTime();
    recordedTimeMillis += (now - previousTimeMillis);
    previousTimeMillis = now;
    
    updateRecordTimer();
  
    timerRequestId = requestAnimationFrame(handleRecordTimer);
  }
  
  function updateRecordTimer() {
    var percent = Math.floor((recordedTimeMillis / MAX_RECORD_TIME_MILLIS) * 100);
    if (percent >= 100) {
      percent = 100;
      stopRecordingWithExport();
    }
    var ratio = percent / 100.0;
    var color  = 'rgba(' + Math.floor(255*ratio) + ',0,' + Math.floor(255*(1-ratio)) + ',1)';
  
    $('#record_timer').css('width', percent + '%');
    $('#record_timer').css('background-color', color);
  }
  
  
  function stopRecordTimer() {
    if (timerRequestId) {
      cancelAnimationFrame(timerRequestId);
      timerRequestId = null;
    }
  }
  
  function resetRecordTimer() {
    stopRecordTimer();
    recordedTimeMillis = 0;
    updateRecordTimer();
  }

  return {
    init: init,
    playWavBlob: playWavBlob
  };
})();
