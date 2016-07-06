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
  // 1 minute (unit: milliseconds)
  var MAX_RECORD_TIME = 60 * 1000;
  
  var intervalId = null;
  
  var visualCanvas = null;
  var visualContext = null;
  
  // Audio
  var audioContext = null;
  var lowpassFilter = null;
  var analyser = null;
  var delay = null
  var recorder = null;
  var isRecording = false;
  
  var timerRequestId = null;
  var recordedTimeMillis = 0;
  var previousTimeMillis = 0;
  
  var MAX_SILENT_THRES = 15;
  
  var loud_thres = 0;
  var silent_thres = 0;
  
  function init() {
    console.log("init()");
  
    audioContext = new AudioContext();
  
    lowpassFilter = audioContext.createBiquadFilter();
    lowpassFilter.type = "lowpass";
    lowpassFilter.frequency.value = 20000;
  
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeContant = 0.9;
  
    delay = audioContext.createDelay()
  
    visualCanvas = document.getElementById('visual');
    visualContext = visualCanvas.getContext('2d');
  
    if (!navigator.getUserMedia) {
      alert("WebRTC(getUserMedia) is not supported.");
      return;
    }
  
    navigator.getUserMedia({video: false, audio: true}, function(stream) {
      var input = audioContext.createMediaStreamSource(stream);
  
      input.connect(lowpassFilter);
      lowpassFilter.connect(analyser);
      startInterval();
  
      // 600ms 遅延状態で録音する
      delay.delayTime.value = 0.6;
      lowpassFilter.connect(delay);
      recorder = new Recorder(delay, { workerPath: 'js/recorderjs/recorderWorker.js' });
      if (!recorder) {
        alert("Failed to create Recorder object");
      }
    }, function() {
      alert("Mic access error!");
      return;
    });
  }
  
  
  function onInterval() {
    if (!analyser) {
      return;
    }
  
    visualContext.fillStyle = "rgb(0,0,0)";
    visualContext.fillRect(0, 0, 256, 256);
  
    var data = new Uint8Array(256);
    analyser.getByteTimeDomainData(data);
    // 物理的に正しいとは思われないが、絶対値を加算してしきい値を設定する
    var accum = 0;
    for (var i = 0; i < 256; ++i) {
      visualContext.fillStyle = "rgb(0,255,0)"
      visualContext.fillRect(i, 256 - data[i], 1, 2);
      // 128 ... 何も音がないとき
      accum += Math.abs(data[i] - 128);
    }
    if (!isRecording) {
      if (accum > 1000) {
        // console.log("accum: " + accum);
        
        // 概ね 300ms 以上うるさかったら録音開始
        loud_thres += 1;
        if (loud_thres > 2) {
          startRecording();  // isRecording = trueとなる
          loud_thres = 0;
          silent_thres = MAX_SILENT_THRES;
        }
      } else {
        loud_thres = 0;
      }
    } else {
      // console.log("accum: " + accum);
      if (accum > 1000) {
        // うるさければ silent_thres はリセットされる
        silent_thres = MAX_SILENT_THRES;
      } else {
        silent_thres--;
        if (silent_thres <= 0) {
          stopRecording();  // isRecording = falseとなる
        }
      }
    }
  }
  
  function startInterval() {
    if (intervalId) {
      return;
    }
  
    intervalId = setInterval(onInterval, 100);
  }
  
  function stopInterval() {
    if (!intervalId) {
      return;
    }
  
    clearInterval(intervalId);
    intervalId = null;
  }
  
  function startRecording() {
    console.log("startRecording()");
    if (isRecording) { // already started.
      return;
    }
    
    isRecording = true;
    startRecordTimer();
    
    recorder.record();
  }
  
  function stopRecording() {
    console.log("stopRecording()");
    if (!isRecording) {
      return;
    }
  
    stopRecordTimer();
    isRecording = false;
  
    recorder.stop();
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
    var percent = Math.floor((recordedTimeMillis / MAX_RECORD_TIME) * 100);
    if (percent >= 100) {
      stopRecording();
      percent = 100;
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
