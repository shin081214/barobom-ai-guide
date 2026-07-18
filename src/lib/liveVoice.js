/**
 * Gemini Live API — real-time voice via WebSocket.
 *
 * Built from official example: gemini-live-api-examples/frontend/geminilive.js
 * Audio format: 16-bit PCM 16kHz LE (IN) / 24kHz LE (OUT)
 */

const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

export function startLiveSession(apiKey, opts = {}) {
  const {
    systemPrompt = '당신은 고령층을 위한 디지털 기기 사용 도우미입니다.',
    onResponse = () => {},
    onTranscription = () => {},
    onStateChange = () => {},
    onError = () => {},
    onVideoStreamChange = () => {},
  } = opts;

  const url = `${WS_BASE}?key=${apiKey}`;
  let ws = null, state = 'idle';
  let micStream = null, micCtx = null, micWorklet = null;

  // Wrap videoStream so any change fires the React-side mirror callback.
  // Without this, React cannot see the closure mutation and the <video>
  // element stays in its initial empty state (fallback to DemoKiosk).
  let videoStream = null;
  function setVideoStream(next) {
    videoStream = next;
    try { onVideoStreamChange(next); } catch { /* listener may be torn down */ }
  }
  let videoEl = null, videoCanvas = null, videoTimer = null;
  let outCtx = null, outWorklet = null, outGain = null;
  let isMuted = false, setupOk = false, quit = null;

  function setState(s) { state = s; onStateChange(s); }

  function sendJson(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }

  /* ── AUDIO OUTPUT (AudioWorklet, 24kHz) ── */
  async function initOutput() {
    if (outCtx && outCtx.state !== 'closed') return;
    outCtx = new AudioContext({ sampleRate: 24000 });
    if (outCtx.state === 'suspended') await outCtx.resume();

    // Inline worklet processor (avoids separate file)
    const blob = new Blob([`
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() { super(); this.buffer = []; this.port.onmessage = (e) => {
          if (e.data === 'interrupt') { this.buffer = []; return; }
          this.buffer.push(new Float32Array(e.data));
        }; }
        process(inputs, outputs) {
          const out = outputs[0][0];
          if (!out) return true;
          const needed = out.length;
          let written = 0;
          while (written < needed && this.buffer.length) {
            const chunk = this.buffer[0];
            const toCopy = Math.min(chunk.length, needed - written);
            out.set(chunk.subarray(0, toCopy), written);
            written += toCopy;
            if (toCopy < chunk.length) this.buffer[0] = chunk.subarray(toCopy);
            else this.buffer.shift();
          }
          if (written < needed) out.fill(0, written);
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await outCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    outWorklet = new AudioWorkletNode(outCtx, 'pcm-processor');
    outGain = outCtx.createGain();
    outGain.gain.value = 1.0;
    outWorklet.connect(outGain);
    outGain.connect(outCtx.destination);
  }

  function playBase64Audio(b64) {
    if (!b64) return;
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
    if (outWorklet) outWorklet.port.postMessage(f32);
  }

  /* ── MICROPHONE INPUT (AudioWorklet, 16kHz) ── */
  async function requestMicPermission() {
    if (micStream) return micStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('이 브라우저에서는 마이크를 사용할 수 없습니다. HTTPS 또는 localhost에서 열어주세요.');
    }
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    return micStream;
  }

  async function initMic() {
    await requestMicPermission();
    micCtx = new AudioContext({ sampleRate: 16000 });

    const blob = new Blob([`
      class CaptureProcessor extends AudioWorkletProcessor {
        constructor() { super(); this.port.onmessage = () => {}; }
        process(inputs) {
          const input = inputs[0][0];
          if (input) this.port.postMessage(input, [input.buffer]);
          return true;
        }
      }
      registerProcessor('audio-capture-processor', CaptureProcessor);
    `], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await micCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    micWorklet = new AudioWorkletNode(micCtx, 'audio-capture-processor');
    micWorklet.port.onmessage = (e) => {
      if (isMuted || !ws || ws.readyState !== WebSocket.OPEN) return;
      const f32 = e.data;
      const pcm16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let b64 = '';
      for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
      b64 = btoa(b64);

      ws.send(JSON.stringify({
        realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } },
      }));
    };

    const source = micCtx.createMediaStreamSource(micStream);
    source.connect(micWorklet);
  }

  function stopMic() {
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (micCtx && micCtx.state !== 'closed') micCtx.close().catch(() => {});
    micCtx = null; micWorklet = null;
  }

  async function requestVideoPermission() {
    if (videoStream) return videoStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('이 브라우저에서는 카메라를 사용할 수 없습니다. HTTPS 또는 localhost에서 열어주세요.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
      },
      audio: false,
    });
    setVideoStream(stream);
    return stream;
  }

  function getVideoFrameBase64() {
    if (!videoEl || !videoCanvas) return null;
    const width = videoEl.videoWidth || 640;
    const height = videoEl.videoHeight || 480;
    if (!width || !height) return null;
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / width);
    videoCanvas.width = Math.round(width * scale);
    videoCanvas.height = Math.round(height * scale);
    const ctx = videoCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, videoCanvas.width, videoCanvas.height);
    return videoCanvas.toDataURL('image/jpeg', 0.72).split(',')[1] || null;
  }

  function sendVideoFrame() {
    const data = getVideoFrameBase64();
    if (!data) return false;
    return sendJson({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } });
  }

  async function initVideoFrames() {
    await requestVideoPermission();
    if (typeof document === 'undefined') throw new Error('이 브라우저에서는 영상 캡처를 초기화할 수 없습니다.');
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
    }
    videoEl.srcObject = videoStream;
    if (typeof videoEl.play === 'function') await videoEl.play();
    videoCanvas = videoCanvas || document.createElement('canvas');
    sendVideoFrame();
    if (videoTimer) clearInterval(videoTimer);
    // Live API video input is image frames, max 1 FPS.
    videoTimer = setInterval(sendVideoFrame, 1000);
  }

  function stopVideo() {
    if (videoTimer) clearInterval(videoTimer);
    videoTimer = null;
    if (videoEl) {
      if (typeof videoEl.pause === 'function') videoEl.pause();
      videoEl.srcObject = null;
    }
    videoEl = null;
    videoCanvas = null;
    if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); setVideoStream(null); }
  }

  /** Send the same static image as a video frame at 1 FPS (camera-unavailable fallback). */
  function startStaticFrameLoop(imageBase64, imageMimeType) {
    if (!imageBase64) return;
    const mime = imageMimeType || 'image/jpeg';
    sendJson({ realtimeInput: { video: { data: imageBase64, mimeType: mime } } });
    if (videoTimer) clearInterval(videoTimer);
    videoTimer = setInterval(() => {
      sendJson({ realtimeInput: { video: { data: imageBase64, mimeType: mime } } });
    }, 1000);
  }

  function stopOutput() {
    if (outCtx && outCtx.state !== 'closed') outCtx.close().catch(() => {});
    outCtx = null; outWorklet = null; outGain = null;
  }

  /* ── WEBSOCKET ── */
  function connect() {
    setState('connecting');
    ws = new WebSocket(url);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-3.1-flash-live-preview',
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              silenceDurationMs: 2000,
              prefixPaddingMs: 500,
              endOfSpeechSensitivity: 'END_SENSITIVITY_UNSPECIFIED',
              startOfSpeechSensitivity: 'START_SENSITIVITY_UNSPECIFIED',
            },
            activityHandling: 'ACTIVITY_HANDLING_UNSPECIFIED',
            turnCoverage: 'TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO',
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }));
    };

    ws.onmessage = async (event) => {
      // Per official example: Blob → text → JSON (NOT raw PCM!)
      let text;
      if (event.data instanceof Blob) {
        text = await event.data.text();
      } else if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data);
      } else {
        text = event.data;
      }

      try {
        const msg = JSON.parse(text);

        if (msg.setupComplete) {
          setupOk = true;
          setState('ready');
          // Release speak() if it is waiting for the WebSocket setup handshake.
          if (quit) {
            const resolveSetup = quit;
            quit = null;
            resolveSetup();
          }
          return;
        }
        if (msg.error) { onError(new Error(msg.error.message)); return; }

        const parts = msg.serverContent?.modelTurn?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) playBase64Audio(part.inlineData.data);
            if (part.text) onResponse(part.text);
          }
        }
        if (msg.serverContent?.inputTranscription) {
          onTranscription({ speaker: 'user', ...msg.serverContent.inputTranscription });
        }
        if (msg.serverContent?.outputTranscription) {
          onTranscription({ speaker: 'model', ...msg.serverContent.outputTranscription });
        }
      } catch {
        // non-JSON binary — ignore
      }
    };

    ws.onclose = (event) => {
      setupOk = false;
      stopMic();
      stopVideo();
      const reason = event?.reason ? `: ${event.reason}` : '';
      console.log('[live] WebSocket closed', event?.code ?? '', reason);
      setState('idle');
    };
    ws.onerror = () => { setState('error'); onError(new Error('WebSocket error')); };
  }

  function waitForSetup() {
    if (setupOk) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        quit = null;
        reject(new Error('Live API 연결 준비 시간이 초과되었습니다.'));
      }, 12000);
      quit = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  /* ── PUBLIC API ── */

  async function speak(imageBase64 = null) {
    if (state === 'idle') connect();

    // Trigger the browser permission prompt immediately. Do not connect the
    // stream to the WebSocket yet; image context must still be sent first.
    const micPermission = requestMicPermission();

    // Initialize audio output ASAP
    await initOutput();

    try {
      await micPermission;
    } catch (err) {
      const detail = err?.message || String(err);
      const name = err?.name && err.name !== 'Error' ? `${err.name}: ` : '';
      console.warn('[live] microphone error:', err?.name, detail);
      onError(new Error(`${name}${detail}`));
      return;
    }

    // ⚡ CRITICAL: wait for server ready BEFORE mic — image must arrive before any audio
    try {
      await waitForSetup();
    } catch (err) {
      onError(err);
      return;
    }
    if (state === 'idle') return;

    // Send image FIRST so the model has visual context before hearing the user
    // Format: clientContent.turns[].parts[] (Live API accepts REST-style inlineData here)
    // turnComplete:false so the model stays in "user turn open" mode and waits for the mic
    console.log('[live] imageBase64 present:', !!imageBase64, 'length:', imageBase64?.length || 0);
    if (imageBase64 && ws && ws.readyState === WebSocket.OPEN) {
      console.log('[live] sending image as clientContent...');
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: 'user',
            parts: [
              { inlineData: { data: imageBase64, mimeType: 'image/png' } },
              { text: '이 화면을 분석하고 사용자가 디지털 기기를 사용할 수 있게 안내해주세요. 버튼이나 클릭해야 하는 특정 영역의 위치를 언급할 때는 반드시 대답 끝에 [box: x, y, w, h] 형태로 0~100 사이의 퍼센트 좌표를 기입하십시오.' },
            ],
          }],
          turnComplete: false,
        },
      }));
      console.log('[live] image sent!');
    }

    // Start forwarding mic audio AFTER image is in context (VAD won't preempt it).
    try {
      await initMic();
    } catch (err) {
      const detail = err?.message || String(err);
      console.warn('[live] microphone initialization error:', err?.name, detail);
      onError(new Error(detail));
      return;
    }

    setState('listening');
  }

  /** Unified live mode: try camera first, fall back to static image sent as video frames. */
  async function speakWithVision(imageBase64 = null, imageMimeType = 'image/jpeg') {
    if (state === 'idle') connect();

    // Request mic immediately from the user gesture.
    const micPermission = requestMicPermission();

    // Also try the rear camera — but don't fail if it's unavailable.
    let cameraOk = false;
    const cameraAttempt = requestVideoPermission().then(() => { cameraOk = true; }).catch((err) => {
      console.log('[live] camera unavailable, will use static image fallback:', err?.name || '');
    });

    await initOutput();

    try { await micPermission; } catch (err) {
      const detail = err?.message || String(err);
      console.warn('[live] microphone error:', err?.name, detail);
      onError(new Error(detail));
      return;
    }

    // Wait for camera attempt to settle (success or failure).
    try { await cameraAttempt; } catch { /* already caught above */ }

    try { await waitForSetup(); } catch (err) { onError(err); return; }
    if (state === 'idle') return;

    if (cameraOk) {
      try { await initVideoFrames(); } catch (err) {
        console.warn('[live] camera init error, switching to static fallback:', err?.name);
        startStaticFrameLoop(imageBase64, imageMimeType);
      }
    } else if (imageBase64) {
      startStaticFrameLoop(imageBase64, imageMimeType);
    }

    // Start mic
    try { await initMic(); } catch (err) {
      console.warn('[live] mic init error:', err?.name, err?.message);
      onError(new Error(err?.message || '마이크 초기화 실패'));
      return;
    }

    setState('listening');
  }

  return {
    async speak(imageBase64) { await speak(imageBase64); },
    async speakWithVision(imageBase64, imageMimeType) { await speakWithVision(imageBase64, imageMimeType); },

    mute() { isMuted = true; setState('muted'); },
    unmute() { isMuted = false; setState('listening'); },

    stop() {
      if (ws) { ws.close(); ws = null; }
      stopMic(); stopVideo(); stopOutput();
      setupOk = false;
      setState('idle');
    },

    sendText(text) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ realtimeInput: { text } }));
    },

    get state() { return state; },
    get videoStream() { return videoStream; },
  };
}
