(function () {
  'use strict';

  function cameraError(name) {
    const error = new Error(name);
    error.name = name;
    return error;
  }

  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (track) { track.stop(); });
  }

  function available() {
    return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
  }

  function createCamera(video, onInterrupted) {
    let generation = 0;
    let stream = null;
    let cancelFrameWait = null;
    let cancelTrackWatch = null;

    function stop() {
      generation++;
      if (cancelFrameWait) cancelFrameWait();
      if (cancelTrackWatch) cancelTrackWatch();
      stopStream(stream);
      stream = null;
      video.pause();
      video.srcObject = null;
    }

    function waitForFrame(track) {
      return new Promise(function (resolve, reject) {
        let timer = null;
        let watchdog = null;

        function finish(error) {
          window.clearInterval(timer);
          window.clearTimeout(watchdog);
          cancelFrameWait = null;
          if (error) reject(error);
          else resolve();
        }

        function cancel() {
          finish(cameraError('AbortError'));
        }

        cancelFrameWait = cancel;
        timer = window.setInterval(function () {
          if (track.readyState === 'ended') finish(cameraError('NotReadableError'));
          else if (!track.muted && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish();
        }, 70);
        watchdog = window.setTimeout(function () { finish(cameraError('NoFrameError')); }, 8000);

        try {
          const playing = video.play();
          if (playing && typeof playing.catch === 'function') {
            playing.catch(function (error) {
              if (cancelFrameWait === cancel) finish(error);
            });
          }
        } catch (error) {
          finish(error);
        }
      });
    }

    function watchTrack(track) {
      let muteTimer = null;
      function interrupted() {
        stop();
        onInterrupted();
      }
      function muted() {
        window.clearTimeout(muteTimer);
        muteTimer = window.setTimeout(interrupted, 1600);
      }
      function unmuted() {
        window.clearTimeout(muteTimer);
      }
      track.addEventListener('ended', interrupted);
      track.addEventListener('mute', muted);
      track.addEventListener('unmute', unmuted);
      cancelTrackWatch = function () {
        unmuted();
        track.removeEventListener('ended', interrupted);
        track.removeEventListener('mute', muted);
        track.removeEventListener('unmute', unmuted);
        cancelTrackWatch = null;
      };
    }

    async function open() {
      stop();
      const attempt = generation;
      if (!available()) throw cameraError('UnavailableError');
      const media = navigator.mediaDevices;
      const supported = typeof media.getSupportedConstraints === 'function' && media.getSupportedConstraints();
      let incoming = null;
      try {
        incoming = await media.getUserMedia({
          audio: false,
          video: { facingMode: { exact: 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        if (generation !== attempt) {
          stopStream(incoming);
          return false;
        }
        const track = incoming.getVideoTracks()[0];
        if (!track) throw cameraError('NotFoundError');
        const settings = (typeof track.getSettings === 'function' && track.getSettings()) || {};
        if ((settings.facingMode && settings.facingMode !== 'user') ||
            (settings.facingMode !== 'user' && !(supported && supported.facingMode === true))) {
          throw cameraError('FrontCameraError');
        }

        stream = incoming;
        video.srcObject = incoming;
        await waitForFrame(track);
        if (generation !== attempt) return false;
        watchTrack(track);
        return true;
      } catch (error) {
        if (generation !== attempt) return false;
        if (incoming && incoming !== stream) stopStream(incoming);
        stop();
        throw error;
      }
    }

    function capture() {
      const track = stream && stream.getVideoTracks()[0];
      const width = video.videoWidth;
      const height = video.videoHeight;
      const viewportWidth = video.clientWidth;
      const viewportHeight = video.clientHeight;
      if (!track || track.readyState !== 'live' || track.muted ||
          video.readyState < 2 || !width || !height || !viewportWidth || !viewportHeight) return null;

      const ratio = viewportWidth / viewportHeight;
      const cropWidth = Math.min(width, height * ratio);
      const cropHeight = Math.min(height, width / ratio);
      const scale = Math.min(1, 1600 / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return null;

      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/jpeg', .89);
      return photo.indexOf('data:image/jpeg;base64,') === 0 ? photo : null;
    }

    return { open: open, stop: stop, capture: capture };
  }

  window.LightCamera = { available: available, create: createCamera };
}());
