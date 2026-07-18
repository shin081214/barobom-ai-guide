'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContainedImageBounds } from './lib/imageBounds.js';
import { getAnonymousId } from './lib/anonId.js';
import { publishEvent, resetSession, identifyDevice, reportObservation } from './lib/feedback.js';
import { startLiveSession } from './lib/liveVoice.js';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Mic,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';

const HERO_PREVIEW_STEP = {
  text: '왼쪽의 김밥 메뉴를 눌러주세요.',
  box: { x: 7, y: 20, w: 40, h: 31 },
  label: '여기를 눌러요',
};

function DemoKiosk() {
  return (
    <div className="kiosk-screen" role="img" aria-label="분식집 키오스크 예시 화면">
      <div className="kiosk-top"><span>← 이전</span><strong>행복분식</strong><span>한국어⌄</span></div>
      <div className="kiosk-body">
        <div className="kiosk-menu">
          <span className="menu-chip active">김밥</span><span className="menu-chip">떡볶이</span><span className="menu-chip">음료</span>
          <div className="food-grid">
            <article><div className="food-photo kimbap">🍙</div><b>참치 김밥</b><small>4,500원</small></article>
            <article><div className="food-photo">🥘</div><b>떡볶이</b><small>5,000원</small></article>
            <article><div className="food-photo">🍜</div><b>라면</b><small>4,000원</small></article>
            <article><div className="food-photo">🥤</div><b>식혜</b><small>2,000원</small></article>
          </div>
        </div>
        <aside className="kiosk-cart"><b>내 주문</b><p>선택한 메뉴가<br />여기에 보여요</p><div className="card-slot">💳 카드</div><button>담기</button></aside>
      </div>
      <div className="kiosk-bottom"><span>총 0개</span><strong>주문 확인</strong></div>
    </div>
  );
}

function VisualGuide({ imageUrl, step }) {
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const [imageBounds, setImageBounds] = useState(null);

  const measureImage = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;

    const frameRect = frame.getBoundingClientRect();
    const bounds = getContainedImageBounds({
      containerWidth: frameRect.width,
      containerHeight: frameRect.height,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
    setImageBounds(bounds ? { ...bounds, source: imageUrl } : null);
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) return undefined;

    const frame = frameRef.current;
    const observer = typeof ResizeObserver === 'function' && frame
      ? new ResizeObserver(measureImage)
      : null;
    observer?.observe(frame);
    window.addEventListener('resize', measureImage);
    if (imageRef.current?.complete) measureImage();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureImage);
    };
  }, [imageUrl, measureImage]);

  const overlayStyle = imageUrl
    ? imageBounds?.source === imageUrl && {
      left: `${imageBounds.left}px`,
      top: `${imageBounds.top}px`,
      width: `${imageBounds.width}px`,
      height: `${imageBounds.height}px`,
    }
    : { inset: 0 };

  return (
    <div className="visual-frame" ref={frameRef}>
      {imageUrl
        ? <img ref={imageRef} src={imageUrl} alt="사용자가 올린 안내 대상 화면" onLoad={measureImage} />
        : <DemoKiosk />}
      {step?.box && overlayStyle && (
        <div className="visual-image-overlay" style={overlayStyle}>
          <div
            className="target-box"
            style={{ left: `${step.box.x}%`, top: `${step.box.y}%`, width: `${step.box.w}%`, height: `${step.box.h}%` }}
            aria-label={`강조 위치: ${step.label}`}
          >
            <span>{step.label}</span><i aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.83;
  window.speechSynthesis.speak(utterance);
}

export default function App() {
  const [stage, setStage] = useState('home');
  const [imageUrl, setImageUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [goals, setGoals] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [textScale, setTextScale] = useState(0);
  const [analysisNote, setAnalysisNote] = useState('이 화면에서 할 수 있는 일을 골랐어요.');
  const [analysisPayload, setAnalysisPayload] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [matchedSkills, setMatchedSkills] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [liveState, setLiveState] = useState('idle');
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const inputRef = useRef(null);
  const goalInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const textScaleLabel = ['보통', '크게', '아주 크게'][textScale];

  const step = selectedGoal?.steps?.[stepIndex];
  const totalSteps = selectedGoal?.steps?.length ?? 0;
  const isLastStep = stepIndex === totalSteps - 1;

  useEffect(() => {
    // Initialize persistent anonymous ID for telemetry (M1)
    getAnonymousId();
  }, []);

  // Cleanup live session on unmount
  useEffect(() => () => {
    if (liveSession) liveSession.stop();
  }, [liveSession]);

  async function fetchGeminiApiKey() {
    try { const res = await fetch('/api/live-key'); return (await res.json()).key || ''; }
    catch { return ''; }
  }

  function createLiveSession(apiKey, skills = []) {
    let prompt = selectedGoal
      ? `당신은 고령층을 위한 디지털 기기 사용 도우미입니다. 사용자는 지금 "${selectedGoal.label}"을(를) 하고 있습니다. 현재 단계: "${step?.text || ''}". 친절하고 쉬운 한국어로 짧게 대답하세요.`
      : '당신은 고령층을 위한 디지털 기기 사용 도우미입니다. 사용자가 카메라 속 화면에 대해 물어보면 친절하고 쉬운 한국어로 대답하세요.';

    // Inject matched skill content as reference knowledge for the model.
    if (skills.length > 0) {
      const skillBlock = skills.map((s) =>
        `## 기기: ${s.title} (${s.brand || ''} ${s.model || ''})\n${s.content}`
      ).join('\n\n');
      prompt += `\n\n[아래는 이 기기에 대해 알고 있는 사용 가이드입니다. 이 정보를 참고해서 더 정확하게 안내해주세요.]\n\n${skillBlock}`;
    }

    return startLiveSession(apiKey, {
      systemPrompt: prompt,
      onResponse: () => {},
      onTranscription: ({speaker, text}) => {
        if (speaker === 'user') console.log('[live] 🎤', text);
        else console.log('[live] 🤖', text);
      },
      onStateChange: (newState) => {
        if (newState === 'ready' || newState === 'listening') setLiveState('listening');
        else if (newState === 'muted') setLiveState('muted');
        else if (newState === 'idle' || newState === 'error') setLiveState('idle');
        else if (newState === 'connecting') setLiveState('connecting');
      },
      onError: (err) => { console.warn('[live]', err.message); setLiveState('idle'); },
    });
  }

  async function toggleLiveVision() {
    if (liveState === 'idle') {
      const apiKey = await fetchGeminiApiKey();
      if (!apiKey) { alert('Gemini API 키가 설정되지 않았습니다.'); return; }

      // Fetch matching device skills from backend so the Live session
      // can reference them during conversation.
      let skills = matchedSkills;
      if (!skills.length && imageBase64) {
        try {
          const result = await identifyDevice(imageBase64, imageMimeType);
          if (result?.device) setDeviceInfo(result.device);
          if (result?.skills?.length) {
            skills = result.skills;
            setMatchedSkills(skills);
          }
        } catch { /* backend may be unreachable — proceed without skills */ }
      }

      const session = createLiveSession(apiKey, skills);
      setLiveSession(session);
      setLiveState('connecting');
      console.log('[app] starting Live API vision mode with', skills.length, 'matched skills');
      await session.speakWithVision(imageBase64, imageMimeType);
    } else if (liveState === 'listening') {
      if (liveSession) liveSession.mute();
    } else if (liveState === 'muted') {
      if (liveSession) liveSession.unmute();
    }
  }

  function stopLiveVoice() {
    if (liveSession) { liveSession.stop(); setLiveSession(null); }
    setLiveState('idle');
  }

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);


  const progress = useMemo(() => totalSteps ? ((stepIndex + 1) / totalSteps) * 100 : 0, [stepIndex, totalSteps]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setSourceName(file.name);
    setGoals([]);
    setAnalysisError('');
    setStage('loading');
    setAnalysisNote('AI가 화면을 살펴보고 있어요.');

    try {
      const dataUrl = await fileToDataUrl(file);
      const [header, image] = dataUrl.split(',');
      const mimeType = header.match(/data:(.*?);base64/)?.[1] || file.type || 'image/jpeg';
      const payload = { image, mimeType, requestedGoal: customRequest.trim() };
      setAnalysisPayload(payload);
      setImageBase64(image);
      setImageMimeType(mimeType);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let apiError = {};
        try {
          apiError = await response.json();
        } catch {
          // Keep the generic error below when the server response is not JSON.
        }
        const error = new Error(apiError.message || 'AI 분석을 사용할 수 없습니다.');
        error.code = apiError.error || (response.status === 429 ? 'RATE_LIMITED' : 'ANALYSIS_FAILED');
        throw error;
      }
      const analysis = await response.json();
      if (!Array.isArray(analysis.goals) || analysis.goals.length === 0) throw new Error('분석 목표가 없습니다.');
      setGoals(analysis.goals);
      setAnalysisNote('AI가 사진을 보고 필요한 안내를 만들었어요.');
      chooseGoal(analysis.goals[0]);
      publishEvent('new_photo_uploaded');

      // Identify device + fetch skills (fire and forget — doesn't block UX)
      identifyDevice(image, mimeType).then((result) => {
        if (result?.device) setDeviceInfo(result.device);
        if (result?.skills?.length) setMatchedSkills(result.skills);
      });
    } catch (error) {
      setAnalysisPayload(null);
      setGoals([]);
      setAnalysisError(
        error?.code === 'RATE_LIMITED'
          ? error.message
          : '사진을 분석하지 못했어요. 화면 전체가 잘 보이게 다시 찍어주세요.',
      );
      setStage('photo');
    }
  }

  function chooseGoal(goal) {
    setSelectedGoal(goal);
    setStepIndex(0);
    setCustomOpen(false);
    setStage('guide');
    publishEvent('guide_started', { goal: goal.label });
  }

  function openCustomRequest() {
    setCustomOpen(true);
    setCustomRequest('');
    setCustomError('');
    setVoiceStatus('idle');
  }

  function closeCustomRequest() {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setCustomOpen(false);
    setVoiceStatus('idle');
    setCustomError('');
  }

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setCustomError('이 브라우저에서는 음성 인식이 어려워요. 아래 칸에 직접 적어주세요.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      setCustomError('');
      setVoiceStatus('listening');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) setCustomRequest(transcript);
    };
    recognition.onerror = () => {
      setCustomError('말소리를 잘 듣지 못했어요. 다시 말하거나 직접 적어주세요.');
      setVoiceStatus('idle');
    };
    recognition.onend = () => setVoiceStatus('idle');
    recognitionRef.current = recognition;
    recognition.start();
  }

  function confirmRequestedGoal(event) {
    event?.preventDefault();
    const request = customRequest.trim();
    if (!request) {
      setCustomError('먼저 하고 싶은 일을 말하거나 적어주세요.');
      return;
    }
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    goalInputRef.current?.blur();
    setCustomRequest(request);
    setCustomError('');
    setStage('photo');
  }

  async function submitCustomRequest() {
    const request = customRequest.trim();
    if (!request) {
      setCustomError('하고 싶은 일을 말하거나 적어주세요.');
      return;
    }

    const simpleRequest = request.replace(/\s/g, '');
    const existingGoal = goals.find((goal) => {
      const label = goal.label.replace(/\s/g, '');
      return label.includes(simpleRequest) || simpleRequest.includes(label);
    });
    if (existingGoal) {
      chooseGoal(existingGoal);
      return;
    }

    if (!analysisPayload) {
      setCustomError('새로운 안내를 만들려면 먼저 실제 화면 사진을 올려주세요.');
      return;
    }

    setCustomLoading(true);
    setCustomError('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...analysisPayload, requestedGoal: request }),
      });
      if (!response.ok) throw new Error('custom analysis failed');
      const analysis = await response.json();
      const customGoal = analysis.goals?.[0];
      if (!customGoal) throw new Error('custom goal missing');
      chooseGoal(customGoal);
    } catch {
      setCustomError('이 일을 안내로 만들지 못했어요. 표현을 바꿔 다시 말해주세요.');
    } finally {
      setCustomLoading(false);
    }
  }

  function nextStep() {
    if (isLastStep) {
      publishEvent('goal_completed', { goal: selectedGoal?.label, totalSteps });
      setStage('done');
    } else {
      const next = stepIndex + 1;
      setStepIndex(next);
      publishEvent('step_shown', { step: next + 1, totalSteps });
      publishEvent('screen_changed', { step: next + 1, totalSteps });
    }
  }

  function reset() {
    stopLiveVoice();
    publishEvent('guide_abandoned');
    resetSession();
    window.speechSynthesis?.cancel?.();
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setStage('home');
    setDeviceInfo(null);
    setMatchedSkills([]);
    setImageUrl('');
    setSourceName('');
    setGoals([]);
    setAnalysisPayload(null);
    setAnalysisError('');
    setSelectedGoal(null);
    setStepIndex(0);
    setCustomOpen(false);
    setCustomRequest('');
    setCustomError('');
    setVoiceStatus('idle');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={`app text-${['normal', 'large', 'xlarge'][textScale]}`}>
      <header className="site-header">
        <button className="brand" type="button" onClick={reset} aria-label="바로봄 처음으로">
          <span className="brand-mark"><Sparkles size={22} /></span>
          <span><strong>바로봄</strong><small>AI 디지털 사용 도우미</small></span>
        </button>
        <div className="header-actions">
          <div className="text-size-controls" role="group" aria-label="글자 크기 조절">
            <button type="button" aria-label="글자 작게" onClick={() => setTextScale((value) => Math.max(0, value - 1))} disabled={textScale === 0}><Minus size={18} /></button>
            <span aria-live="polite"><b>가</b><small>{textScaleLabel}</small></span>
            <button type="button" aria-label="글자 크게" onClick={() => setTextScale((value) => Math.min(2, value + 1))} disabled={textScale === 2}><Plus size={18} /></button>
          </div>
          <span className="privacy"><ShieldCheck size={17} /> 사진은 저장하지 않아요</span>
        </div>
      </header>

      <main className={`main-content stage-${stage}`}>
        {stage === 'home' && (
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow"><Sparkles size={16} /> 1단계 · 먼저 할 일을 정해요</span>
              <h1 aria-label="무엇을 하고 싶으세요?">무엇을 하고<br /><em>싶으세요?</em></h1>
              <p>하고 싶은 일을 먼저 알려주세요. 그다음 필요한 화면을 찍을게요.</p>
              <form className="intent-card" onSubmit={confirmRequestedGoal}>
                <div className="intent-input-wrap">
                  <label className="custom-input-label">
                    <span>하고 싶은 일</span>
                    <input ref={goalInputRef} value={customRequest} onChange={(event) => setCustomRequest(event.target.value)} placeholder="예: 빅맥 주문하기" />
                  </label>
                  <button
                    className={`intent-mic-button ${voiceStatus === 'listening' ? 'is-listening' : ''}`}
                    type="button"
                    aria-label="말로 입력하기"
                    title={voiceStatus === 'listening' ? '듣고 있어요' : '말로 입력하기'}
                    onClick={startListening}
                    disabled={voiceStatus === 'listening'}
                  >
                    <Mic size={22} aria-hidden="true" />
                  </button>
                </div>
                {customError && <p className="voice-message is-error" role="alert">{customError}</p>}
                <button type="submit" className="primary-button intent-next">
                  다음 단계 <ChevronRight size={20} />
                </button>
                <button type="button" className="secondary-button intent-live">
                  <Mic size={20} aria-hidden="true" />
                  실시간 AI로 시작
                </button>
              </form>
              <div className="trust-row">
                <span><Check size={17} /> 회원가입 없이</span>
                <span><Check size={17} /> 큰 글씨로 쉽게</span>
                <span><Check size={17} /> 목소리로도 안내</span>
              </div>
            </div>
            <div className="hero-preview" aria-label="서비스 사용 예시">
              <VisualGuide step={HERO_PREVIEW_STEP} />
              <div className="speech-card"><Volume2 size={20} /><span><small>1단계</small>왼쪽의 김밥 메뉴를 눌러주세요.</span></div>
              <span className="floating-note note-one">딱 필요한 곳만</span>
              <span className="floating-note note-two">한 단계씩 천천히</span>
            </div>
          </section>
        )}

        {stage === 'photo' && (
          <section className="photo-stage">
            <button className="back-button" type="button" onClick={() => setStage('home')}><ArrowLeft size={20} /> 할 일 다시 적기</button>
            <span className="step-label"><Camera size={17} /> 2단계 · 화면 사진 찍기</span>
            <h1>이제 화면을 찍어주세요</h1>
            <p className="photo-purpose">도와드릴 일 <strong>{customRequest}</strong></p>
            <p>누를 버튼과 글자가 모두 보이도록 화면 전체를 찍어주세요.</p>
            <label className="primary-button photo-upload-button" role="button" tabIndex={0}
              aria-label="사진 찍기"
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
            >
              <Camera size={25} aria-hidden="true" />
              <span aria-hidden="true">사진 찍기</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="barobom-file-input"
                tabIndex={-1}
              />
            </label>
            {analysisError && <p className="analysis-error" role="alert"><CircleHelp size={20} /> {analysisError}</p>}
          </section>
        )}

        {stage === 'loading' && (
          <section className="loading-card" aria-live="polite">
            <div className="scan-preview"><VisualGuide imageUrl={imageUrl} /><i /></div>
            <span className="loading-spark"><Sparkles size={31} /></span>
            <h1>화면을 살펴보고 있어요</h1>
            <p>버튼과 글자를 찾는 중이에요. 잠시만 기다려주세요.</p>
            <div className="loading-dots"><i /><i /><i /></div>
          </section>
        )}

        {stage === 'goals' && (
          <section className="workspace goals-workspace">
            <div className="workspace-head">
              <button className="back-button" type="button" onClick={reset}><ArrowLeft size={20} /> 처음으로</button>
              <div><span className="step-label">사진 확인 완료</span><h1>무엇을 하고 싶으세요?</h1><p>원하는 일을 하나 골라주세요.</p></div>
            </div>
            <div className="workspace-grid">
              <div className="image-card">
                <div className="image-card-head"><span className="status-dot" />{sourceName}
                  <label className="image-card-change" role="button" tabIndex={0}
                    aria-label="사진 바꾸기"
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                  >
                    <span aria-hidden="true">사진 바꾸기</span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFile}
                      className="barobom-file-input"
                      tabIndex={-1}
                    />
                  </label>
                </div>
                <VisualGuide imageUrl={imageUrl} />
              </div>
              <div className="goal-panel">
                <div className="ai-badge"><Sparkles size={18} /><span><b>화면을 살펴봤어요</b><small>{analysisNote}</small></span></div>
                {deviceInfo && (
                  <div className="device-badge" style={{
                    background: '#f0f7ff', border: '1px solid #b8d8ff', borderRadius: 12,
                    padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: 24 }}>🖥️</span>
                    <div>
                      <strong style={{ fontSize: 15 }}>{deviceInfo.name}</strong>
                      <small style={{ display: 'block', color: '#666', marginTop: 2 }}>
                        {deviceInfo.brand} · {deviceInfo.model} · {deviceInfo.category}
                      </small>
                    </div>
                  </div>
                )}
                {!customOpen ? (
                  <>
                    <div className="goal-list">
                      {goals.map((goal) => (
                        <button className="goal-button" type="button" key={goal.id} onClick={() => chooseGoal(goal)}>
                          <span className="goal-icon">{goal.icon}</span>
                          <span><strong>{goal.label}</strong><small>{goal.hint}</small></span>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <button className="help-link" type="button" onClick={openCustomRequest}><CircleHelp size={19} /> 원하는 일이 목록에 없어요</button>
                  </>
                ) : (
                  <section className="voice-panel" aria-labelledby="voice-panel-title">
                    <button className="voice-close" type="button" onClick={closeCustomRequest} aria-label="음성 입력 닫기"><X size={21} /></button>
                    <span className={`voice-orb ${voiceStatus === 'listening' ? 'is-listening' : ''}`}><Mic size={30} /></span>
                    <h2 id="voice-panel-title">원하는 일을 말해주세요</h2>
                    <p>예: “탈수만 하기”, “온도를 23도로 올리기”</p>
                    <button className={`voice-start ${voiceStatus === 'listening' ? 'is-listening' : ''}`} type="button" onClick={startListening} disabled={voiceStatus === 'listening'}>
                      <Mic size={22} /> {voiceStatus === 'listening' ? '듣고 있어요…' : '말하기 시작'}
                    </button>
                    <div className="voice-divider"><span>또는 직접 적어도 돼요</span></div>
                    <label className="custom-input-label">
                      <span>하고 싶은 일</span>
                      <input value={customRequest} onChange={(event) => setCustomRequest(event.target.value)} placeholder="예: 예약 세탁하기" />
                    </label>
                    <p className={`voice-message ${customError ? 'is-error' : ''}`} aria-live="polite">
                      {customError || (customRequest ? `“${customRequest}” 안내를 찾아드릴게요.` : '마이크를 누르고 천천히 말씀해주세요.')}
                    </p>
                    <div className="voice-actions">
                      <button type="button" className="secondary-button" onClick={closeCustomRequest}>취소</button>
                      <button type="button" className="primary-button" onClick={submitCustomRequest} disabled={customLoading}>
                        {customLoading ? '안내 만드는 중…' : '이대로 안내받기'} <ChevronRight size={20} />
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </div>
            {/* file input now lives inside the photo-upload label in the hero
                and the photo-change label in the goals workspace. Keeping a
                third placeholder here would race the onChange handler. */}
          </section>
        )}

        {stage === 'guide' && step && (
          <section className="workspace guide-workspace">
            <div className="guide-topbar">
              <button className="back-button" type="button" onClick={() => setStage('photo')}><ArrowLeft size={20} /> 사진 다시 찍기</button>
              <div className="guide-title"><span>{selectedGoal.icon}</span><div><small>지금 도와드리는 일</small><strong>{selectedGoal.label}</strong></div></div>
              <button className="reset-button" type="button" onClick={reset}><RotateCcw size={18} /> 처음부터</button>
            </div>
            <div className="guide-layout">
              <div className="image-card guide-image"><VisualGuide imageUrl={imageUrl} step={step} /></div>
              <aside className="instruction-card">
                <div className="progress-head"><span>{stepIndex + 1} / {totalSteps} 단계</span><small>천천히 하셔도 괜찮아요</small></div>
                <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
                <div className="instruction-body">
                  <span className="instruction-number">{stepIndex + 1}</span>
                  <h2>{step.text}</h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="listen-button" type="button" onClick={() => { speak(step.text); publishEvent('step_repeated', { step: stepIndex + 1 }); }}><Volume2 size={22} /> 다시 듣기</button>{' '}
                  <button className="wrong-report-button" type="button" onClick={async () => {
                    publishEvent('user_reported_wrong', { step: stepIndex + 1 });
                    if (deviceInfo?.id) {
                      try {
                        await reportObservation({
                          deviceId: deviceInfo.id,
                          observationType: 'wrong_step',
                          stepIndex: stepIndex + 1,
                          description: `"${selectedGoal?.label}" 안내 중 ${stepIndex + 1}단계 오류 신고`,
                        });
                      } catch {}
                    }
                    alert('피드백을 보내주셔서 감사합니다. 더 나은 안내를 위해 반영하겠습니다.');
                  }} style={{ background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', borderRadius: 12, padding: '10px 18px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>잘못됐어요</button>{' '}
                  <button
                    className={`live-vision-button ${liveState !== 'idle' ? 'is-active' : ''}`}
                    type="button"
                    onClick={toggleLiveVision}
                    style={{
                      background: liveState === 'listening' ? '#dc3545' : liveState === 'muted' ? '#ffc107' : liveState === 'connecting' ? '#17a2b8' : '#6f42c1',
                      color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px',
                      fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Mic size={20} />
                    {liveState === 'idle' && '음성으로 물어보기'}
                    {liveState === 'connecting' && '연결 중...'}
                    {liveState === 'listening' && '듣는 중 (눌러서 음소거)'}
                    {liveState === 'muted' && '음소거 됨 (눌러서 다시 듣기)'}
                  </button>
                  {liveState !== 'idle' && (
                    <button type="button" onClick={stopLiveVoice} style={{
                      background: '#6c757d', color: '#fff', border: 'none', borderRadius: 12,
                      padding: '10px 14px', fontSize: 14, cursor: 'pointer',
                    }}>✕ 종료</button>
                  )}
                  </div>
                </div>
                <div className="guide-controls">
                  <button className="previous-button" type="button" onClick={() => { setStepIndex((index) => Math.max(0, index - 1)); publishEvent('step_back', { step: stepIndex }); publishEvent('screen_changed', { step: stepIndex, totalSteps }); }} disabled={stepIndex === 0}><ChevronLeft /> 이전</button>
                  <button className="next-button" type="button" onClick={nextStep}>{isLastStep ? '다 했어요' : '다음 단계'} <ChevronRight /></button>
                </div>
                <p className="safety-note"><ShieldCheck size={18} /> 화면을 직접 눌러야 다음으로 넘어가요. AI가 대신 결제하지 않아요.</p>
              </aside>
            </div>
          </section>
        )}

        {stage === 'done' && (
          <section className="done-card">
            <span className="done-icon"><Check size={48} /></span>
            <p>안내가 끝났어요</p>
            <h1>잘하셨어요!</h1>
            <span>{selectedGoal?.label} 안내를 모두 마쳤어요.</span>
            <div><button className="primary-button" type="button" onClick={reset}><Camera size={22} /> 다른 화면 찍기</button><button className="secondary-button" type="button" onClick={() => { setStepIndex(0); setStage('guide'); }}><RotateCcw size={20} /> 다시 보기</button></div>
          </section>
        )}
      </main>

      <footer><span>바로봄</span><p>모르는 화면 앞에서 혼자 고민하지 마세요.</p></footer>
    </div>
  );
}
