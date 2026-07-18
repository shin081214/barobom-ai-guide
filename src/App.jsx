'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContainedImageBounds } from './lib/imageBounds.js';
import { getAnonymousId } from './lib/anonId.js';
import { publishEvent, resetSession, identifyDevice, reportObservation } from './lib/feedback.js';
import { startLiveSession } from './lib/liveVoice.js';
import { fetchSkills, fetchObservations } from './lib/skillsApi.js';
import { getConsent, setConsent } from './lib/consent.js';

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

function parseBoxFromText(text) {
  if (!text) return null;
  const match = text.match(/\[box:\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]/i);
  if (match) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const w = parseFloat(match[3]);
    const h = parseFloat(match[4]);

    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
      return null;
    }
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      w: Math.max(0, Math.min(100, w)),
      h: Math.max(0, Math.min(100, h)),
    };
  }
  return null;
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
  const [skillsData, setSkillsData] = useState([]);
  const [obsData, setObsData] = useState([]);
  const [consent, setConsentState] = useState(() => getConsent());
  const [liveChoiceOpen, setLiveChoiceOpen] = useState(false);
  const [isLivePhotoMode, setIsLivePhotoMode] = useState(false);
  const [liveBox, setLiveBox] = useState(null);
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

  function handleConsentChange(value) {
    setConsentState(value);
    setConsent(value);
  }

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

    prompt += `\n\n[안내 상자 표시 기능]
사용자가 화면의 특정 버튼, 메뉴, 혹은 입력창의 위치를 물어보거나, 당신이 특정 위치를 가리키며 안내할 때는 반드시 해당 영역의 대략적인 퍼센트 좌표를 계산하여 대답(text)의 끝에 \`[box: x, y, w, h]\` 형태로 0~100 사이의 숫자로 기입해 주십시오. (예: "여기 왼쪽 위의 김밥 메뉴를 눌러보세요. [box: 7, 20, 40, 31]")
- x: 상자의 좌측 상단 가로 시작점 (%)
- y: 상자의 좌측 상단 세로 시작점 (%)
- w: 상자의 가로 너비 (%)
- h: 상자의 세로 높이 (%)
반드시 사용자가 볼 수 있는 기기 화면 내부의 해당 컴포넌트 위치에 맞추어 정확하게 좌표를 추정해 제공하십시오. 일반적인 인사나 일상 대화, 기기 위치를 가리키지 않는 응답에서는 절대로 이 태그를 포함하지 마십시오.`;

    let accumulatedText = '';

    return startLiveSession(apiKey, {
      systemPrompt: prompt,
      onResponse: (text) => {
        accumulatedText += text;
        const box = parseBoxFromText(accumulatedText);
        if (box) {
          setLiveBox(box);
        }
      },
      onTranscription: ({speaker, text}) => {
        if (speaker === 'user') {
          console.log('[live] 🎤', text);
          accumulatedText = '';
          setLiveBox(null);
        } else {
          console.log('[live] 🤖', text);
        }
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

  async function startLiveFromHome() {
    const apiKey = await fetchGeminiApiKey();
    if (!apiKey) { alert('Gemini API 키가 설정되지 않았습니다.'); return; }

    // Set a dummy goal so the guide UI can render the live controls.
    const dummyGoal = {
      id: 'goal-live', label: '실시간 AI 도움', hint: '음성으로 물어보세요', icon: '🤖',
      steps: [{ text: '화면을 보여주며 음성으로 질문하세요.', label: '실시간', box: null }],
    };
    setSelectedGoal(dummyGoal);
    setStepIndex(0);
    setImageUrl('');
    setImageBase64(null);
    setDeviceInfo(null);
    setMatchedSkills([]);

    const session = createLiveSession(apiKey, []);
    setLiveSession(session);
    setLiveState('connecting');
    setStage('guide');
    await session.speakWithVision(null, 'image/jpeg');
  }

  function startLiveWithPhotoUpload() {
    setLiveChoiceOpen(false);
    setIsLivePhotoMode(true);
    setStage('photo');
  }

  function stopLiveVoice() {
    if (liveSession) { liveSession.stop(); setLiveSession(null); }
    setLiveState('idle');
  }

  async function viewSkills() {
    setStage('skills');
    try {
      const [skills, obs] = await Promise.all([
        fetchSkills(),
        fetchObservations(),
      ]);
      setSkillsData(skills);
      setObsData(obs);
    } catch { /* backend unreachable */ }
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

      if (isLivePhotoMode) {
        setStage('loading');
        setAnalysisNote('실시간 AI와 연결을 시작합니다.');
        
        const apiKey = await fetchGeminiApiKey();
        if (!apiKey) {
          alert('Gemini API 키가 설정되지 않았습니다.');
          setStage('photo');
          return;
        }

        const dummyGoal = {
          id: 'goal-live', label: '실시간 AI 도움', hint: '음성으로 물어보세요', icon: '🤖',
          steps: [{ text: '올려주신 사진을 보며 궁금한 점을 말로 물어보세요.', label: '실시간', box: null }],
        };
        setSelectedGoal(dummyGoal);
        setStepIndex(0);
        setImageBase64(image);
        setImageMimeType(mimeType);
        setDeviceInfo(null);
        setMatchedSkills([]);

        // Try to identify device in the background so skills can be loaded if found
        identifyDevice(image, mimeType).then((result) => {
          if (result?.device) setDeviceInfo(result.device);
          if (result?.skills?.length) setMatchedSkills(result.skills);
        }).catch(() => {});

        const session = createLiveSession(apiKey, []);
        setLiveSession(session);
        setLiveState('connecting');
        setStage('guide');
        await session.speak(image);
        return;
      }

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
    setLiveChoiceOpen(false);
    setIsLivePhotoMode(false);
    setLiveBox(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const displayStep = useMemo(() => {
    if (selectedGoal?.id === 'goal-live' && liveBox) {
      return {
        ...step,
        box: liveBox,
        label: '여기예요',
      };
    }
    return step;
  }, [selectedGoal, step, liveBox]);

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
          <span className="privacy"><ShieldCheck size={17} /> {consent ? '사진은 마스킹 후 개선에 쓰여요' : '사진은 저장하지 않아요'}</span>
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
                {!liveChoiceOpen ? (
                  <>
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
                    <div className="consent-checkbox-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 16, width: '100%', justifyContent: 'flex-start' }}>
                      <input
                        id="consent-checkbox"
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => handleConsentChange(e.target.checked)}
                        style={{ width: 20, height: 20, cursor: 'pointer' }}
                      />
                      <label htmlFor="consent-checkbox" style={{ fontSize: 15, cursor: 'pointer', color: '#4a5568' }}>
                        더 나은 안내를 위해 사진 제공에 동의합니다 (선택)
                      </label>
                    </div>
                    <button type="submit" className="primary-button intent-next">
                      다음 단계 <ChevronRight size={20} />
                    </button>
                    <button type="button" className="secondary-button intent-live" onClick={() => setLiveChoiceOpen(true)}>
                      <Mic size={20} aria-hidden="true" />
                      실시간 AI로 시작
                    </button>
                  </>
                ) : (
                  <div className="live-choice-box" style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', padding: '4px 0' }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#2d3748', textAlign: 'center', fontWeight: 700 }}>
                      실시간 AI 도움 방식을 선택해주세요
                    </h3>
                    <button type="button" className="primary-button" onClick={startLiveFromHome} style={{ background: '#6f42c1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, fontSize: 16 }}>
                      📹 카메라 실시간 영상으로 도움받기
                    </button>
                    <button type="button" className="primary-button" onClick={startLiveWithPhotoUpload} style={{ background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, fontSize: 16 }}>
                      📸 사진을 먼저 한 장 찍어서 도움받기
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setLiveChoiceOpen(false)} style={{ height: 48, fontSize: 15 }}>
                      취소하고 돌아가기
                    </button>
                  </div>
                )}
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
            {isLivePhotoMode ? (
              <>
                <button className="back-button" type="button" onClick={reset}><ArrowLeft size={20} /> 처음으로</button>
                <span className="step-label"><Camera size={17} /> 실시간 AI 도움 · 사진 등록</span>
                <h1>도움받을 화면을 찍어주세요</h1>
                <p style={{ fontSize: 16, color: '#4a5568', marginTop: 12, marginBottom: 24, lineHeight: 1.5, textAlign: 'center', maxWidth: 480 }}>
                  안내받을 기기나 화면 전체가 잘 보이게 찍어주세요.<br />사진을 올리면 바로 실시간 AI 대화가 시작됩니다.
                </p>
              </>
            ) : (
              <>
                <button className="back-button" type="button" onClick={() => setStage('home')}><ArrowLeft size={20} /> 할 일 다시 적기</button>
                <span className="step-label"><Camera size={17} /> 2단계 · 화면 사진 찍기</span>
                <h1>이제 화면을 찍어주세요</h1>
                <p className="photo-purpose">도와드릴 일 <strong>{customRequest}</strong></p>
                <p>누를 버튼과 글자가 모두 보이도록 화면 전체를 찍어주세요.</p>
              </>
            )}
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
              <button className="back-button" type="button" onClick={() => setStage(selectedGoal?.id === 'goal-live' ? 'home' : 'photo')}><ArrowLeft size={20} /> {selectedGoal?.id === 'goal-live' ? '처음으로' : '사진 다시 찍기'}</button>
              <div className="guide-title"><span>{selectedGoal.icon}</span><div><small>지금 도와드리는 일</small><strong>{selectedGoal.label}</strong></div></div>
              <button className="reset-button" type="button" onClick={reset}><RotateCcw size={18} /> 처음부터</button>
            </div>
            <div className="guide-layout">
              <div className="image-card guide-image"><VisualGuide imageUrl={imageUrl} step={displayStep} /></div>
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
                {selectedGoal?.id !== 'goal-live' && (
                <div className="guide-controls">
                  <button className="previous-button" type="button" onClick={() => { setStepIndex((index) => Math.max(0, index - 1)); publishEvent('step_back', { step: stepIndex }); publishEvent('screen_changed', { step: stepIndex, totalSteps }); }} disabled={stepIndex === 0}><ChevronLeft /> 이전</button>
                  <button className="next-button" type="button" onClick={nextStep}>{isLastStep ? '다 했어요' : '다음 단계'} <ChevronRight /></button>
                </div>
                )}
                {selectedGoal?.id !== 'goal-live' && (
                <p className="safety-note"><ShieldCheck size={18} /> 화면을 직접 눌러야 다음으로 넘어가요. AI가 대신 결제하지 않아요.</p>
                )}
                {selectedGoal?.id === 'goal-live' && (
                <button className="primary-button" type="button" onClick={reset} style={{ width: '100%', marginTop: 8 }}><RotateCcw size={18} /> 처음으로 돌아가기</button>
                )}
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

        {stage === 'skills' && (
          <section className="workspace skills-dashboard">
            <div className="workspace-head">
              <button className="back-button" type="button" onClick={() => setStage('guide')}><ArrowLeft size={20} /> 안내로 돌아가기</button>
              <div><span className="step-label">🧠 Skill 자기 개선 현황</span><h1>AI가 배운 내용</h1><p>사용자 피드백을 바탕으로 Gemini가 Skill을 개선하는 과정입니다.</p></div>
            </div>

            <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
              {/* Observations summary */}
              <div style={{ background: '#f0f7ff', border: '1px solid #b8d8ff', borderRadius: 16, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📊</span> 수집된 사용자 피드백
                </h3>
                {obsData.length === 0 ? (
                  <p style={{ color: '#666', margin: 0 }}>아직 수집된 피드백이 없습니다. 사용자가 &quot;잘못됐어요&quot; 버튼을 누르면 여기에 쌓입니다.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {obsData.map((o) => (
                      <div key={o.id} style={{ background: 'white', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                        <span style={{
                          background: o.type === 'wrong_step' ? '#fde8e8' : o.type === 'missing_step' ? '#fef3c7' : '#d1fae5',
                          color: o.type === 'wrong_step' ? '#9b1c1c' : o.type === 'missing_step' ? '#92400e' : '#065f46',
                          padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                        }}>{o.type === 'wrong_step' ? '❌ 오류' : o.type === 'missing_step' ? '➕ 누락' : '✅ 정확'}</span>
                        <span style={{ color: '#666', fontSize: 12 }}>step {o.step_index}</span>
                        <span style={{ flex: 1 }}>{o.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#666' }}>
                  💡 3건 이상 쌓이면 Gemini가 자동으로 Skill 초안을 생성합니다.
                </p>
              </div>

              {/* Skills list */}
              <div style={{ background: 'white', border: '1px solid #e1e8e3', borderRadius: 16, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📚</span> Skill 버전 히스토리
                </h3>
                {skillsData.length === 0 ? (
                  <p style={{ color: '#666', margin: 0 }}>백엔드에서 데이터를 불러오는 중...</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {skillsData.map((s) => (
                      <div key={s.id} style={{
                        background: s.status === 'published' ? '#f0fdf4' : s.status === 'deprecated' ? '#f9fafb' : '#fffbeb',
                        border: `1px solid ${s.status === 'published' ? '#86efac' : s.status === 'deprecated' ? '#d1d5db' : '#fde68a'}`,
                        borderRadius: 12, padding: '14px 18px', opacity: s.status === 'deprecated' ? 0.6 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: 16 }}>{s.title}</span>
                          <span style={{
                            padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            background: s.status === 'published' ? '#16a34a' : s.status === 'deprecated' ? '#6b7280' : '#d97706',
                            color: 'white',
                          }}>{s.status === 'published' ? '✅ 게시됨' : s.status === 'deprecated' ? '🗄️ 폐기됨' : '📝 초안'}</span>
                          <span style={{ color: '#888', fontSize: 12 }}>v{s.version}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          {s.status === 'published' && '현재 사용자에게 제공되는 Skill입니다.'}
                          {s.status === 'draft' && '아직 평가를 통과하지 못했습니다. &quot;주의사항&quot; 섹션 등 필수 조건을 확인하세요.'}
                          {s.status === 'deprecated' && '새 버전이 게시되어 더 이상 사용되지 않습니다.'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p style={{ fontSize: 12, color: '#999', textAlign: 'center', margin: '8px 0' }}>
                파이프라인: 잘못됐어요 → 관찰 3건 → Gemini 초안 → 평가(100점) → 게시 → ChromaDB 갱신
              </p>
            </div>
          </section>
        )}
      </main>

      <footer><span>바로봄</span><p>모르는 화면 앞에서 혼자 고민하지 마세요.</p><a href="#" role="button" onClick={(e) => { e.preventDefault(); viewSkills(); }} style={{ color: '#667eea', textDecoration: 'underline', fontSize: 13, marginTop: 6, display: 'inline-block' }}>🧠 AI 스킬 현황 보기</a></footer>
    </div>
  );
}
