'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, CameraOff, Loader2, AlertCircle, Clock, Monitor } from 'lucide-react';
import Image from 'next/image';

// ── IDB chunk helpers (recording) ─────────────────────────────────────────────
const IDB_NAME  = 'voice-r1-recording-chunks';
const IDB_STORE = 'chunks';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { autoIncrement: true });
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}
function idbSaveChunk(db: IDBDatabase, chunk: Blob): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add(chunk);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
function idbClearChunks(db: IDBDatabase): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage = 'setup' | 'starting' | 'active' | 'analyzing' | 'ended' | 'connection-error';

interface ConversationEntry {
  role: 'interviewer' | 'candidate';
  text: string;
}

interface Props {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  dossier?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function splitIntoTTSChunks(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VoiceInterviewRound1({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  dossier,
}: Props) {
  const firstName = candidateName.split(' ')[0] || candidateName;

  // ── Stage ────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('setup');

  // ── Setup state ──────────────────────────────────────────────────────────
  const [mediaCheckDone, setMediaCheckDone] = useState(false);
  const [screenShared, setScreenShared] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [micError, setMicError] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  // ── Active state ─────────────────────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');      // current turn interim+final
  const [subtitle, setSubtitle] = useState('');           // what Serena just said
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const checkVideoRef   = useRef<HTMLVideoElement>(null);
  const camVideoRef     = useRef<HTMLVideoElement>(null);
  const checkStreamRef  = useRef<MediaStream | null>(null);  // camera+mic from media check
  const micStreamRef    = useRef<MediaStream | null>(null);  // mic stream, kept open for interview
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Recording
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const recordingDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const chunkDBRef       = useRef<IDBDatabase | null>(null);
  const chunkIndexRef    = useRef(0);
  const pendingUploadsRef = useRef<Promise<void>[]>([]);
  const isRecordingRef   = useRef(false);
  const recordingMimeRef = useRef('video/webm');

  // Deepgram STT
  const deepgramSocketRef   = useRef<WebSocket | null>(null);
  const sttRecorderRef      = useRef<MediaRecorder | null>(null);
  const finalTranscriptRef  = useRef('');

  // Conversation & state refs (stable across re-renders for callbacks)
  const conversationRef  = useRef<ConversationEntry[]>([]);
  const isSpeakingRef    = useRef(false);
  const speakCancelRef   = useRef(false);
  const stageRef         = useRef<Stage>('setup');

  // Timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Welcome TTS prefetch
  const welcomePromisesRef = useRef<Promise<Blob>[] | null>(null);

  // endInterview stable ref
  const endInterviewRef = useRef<(() => Promise<void>) | null>(null);

  // ── System prompt ─────────────────────────────────────────────────────────
  const dossierText = dossier?.map((q, i) => `${i + 1}. ${q}`).join('\n') || '';

  const systemPrompt = `=== YOUR IDENTITY ===
NAME: Serena
ROLE: Elite Talent Scout at Printerpix.
VIBE: Warm but sharp. Hunting for A-Players — genuine drive, self-awareness, resilience.
GOAL: Determine if ${candidateName} has real hunger and ownership.

=== THE CANDIDATE ===
NAME: ${candidateName}
ROLE: ${jobTitle}
RESUME: ${resumeText?.substring(0, 800) || 'No resume provided.'}

=== INTERVIEW STRUCTURE (7 SECTIONS, ~28 MINUTES) ===
Work through each section in order. Never announce section names.

1. Warm-up & Motivation (4 min): "Why this role specifically — not just the field?"
2. Drive & Ownership (4 min): "Tell me about something hard you pushed through that was personally initiated."
3. Resilience & Stress (4 min): "Describe a time you failed at something you cared about. What did you do next?"
4. Self-Awareness (4 min): "What is a professional weakness you are actively working on right now, and what is your plan?"
5. Collaboration Story (4 min): "Tell me about a moment where you disagreed with a teammate. How did it end?"
6. Technical Signal (5 min): "Walk me through the most interesting technical problem you've worked on recently — what was the challenge and how did you approach it?" One follow-up max: "What tradeoffs did you consider?"
7. Culture Signal (3 min): Work style, autonomy comfort, alignment.

=== DYNAMIC PROBE TRIGGERS ===
- Vague answer → "Can you be more specific about what you did versus what the team did?"
- Over-polished → "What would the other person in that story say about it?"
- Deflects blame → "What would you do differently if you faced that again?"

=== INTERVIEW RULES ===
1. Max 2 follow-up probes per topic, then move on.
2. Keep responses under 60 words unless absolutely necessary.
3. NEVER pretend to be the candidate. You ask questions only.
4. When ready to close (at ~28 min or after all sections): say the closing script word for word.

=== CLOSING SCRIPT ===
"${firstName}, you've given me a very clear picture today. Thank you for being so open — I really appreciate it. Our team will review everything and be in touch very soon. Best of luck. [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end.

${dossierText ? `=== ADDITIONAL FOCUS AREAS ===\n${dossierText}` : ''}`;

  // ── TTS: play a blob (routes TTS audio through AudioContext for recording) ─
  const playBlob = useCallback(async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    if (audioCtxRef.current && recordingDestRef.current) {
      try {
        const src = audioCtxRef.current.createMediaElementSource(audio);
        src.connect(recordingDestRef.current);
        src.connect(audioCtxRef.current.destination);
      } catch { /* ignore — AudioContext may not be running yet */ }
    }
    await new Promise<void>((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    });
  }, []);

  // ── TTS: speak text via Deepgram TTS ─────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    isSpeakingRef.current = true;
    speakCancelRef.current = false;
    setIsSpeaking(true);
    setSubtitle(text);

    const chunks = splitIntoTTSChunks(text);
    const audioPromises = chunks.map(chunk =>
      fetch('/api/deepgram-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk }),
      }).then(r => {
        if (!r.ok) throw new Error('TTS failed');
        return r.blob();
      })
    );

    try {
      for (let i = 0; i < audioPromises.length; i++) {
        if (speakCancelRef.current) break;
        const blob = await audioPromises[i];
        if (speakCancelRef.current) break;
        await playBlob(blob);
      }
    } catch {
      // TTS failed — just stop speaking, don't play browser fallback (avoids duplicate voices)
    } finally {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [playBlob]);

  // ── STT: stop listening (CRITICAL FIX: do NOT stop mic tracks) ───────────
  const stopListening = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setIsListening(false);

    if (sttRecorderRef.current) {
      try { sttRecorderRef.current.stop(); } catch { /* ignore */ }
      sttRecorderRef.current = null;
    }
    if (deepgramSocketRef.current) {
      deepgramSocketRef.current.close();
      deepgramSocketRef.current = null;
    }
    // ⚠️  DO NOT stop micStreamRef tracks — mic stays open for the full interview.
    // Stopping tracks here is what caused "voice not picked up from Q2 onwards".
  }, []);

  // ── STT: start listening ──────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (isSpeakingRef.current) return;
    if (!micStreamRef.current) return;

    try {
      const response = await fetch('/api/deepgram');
      if (!response.ok) throw new Error('Failed to get Deepgram key');
      const { key } = await response.json();

      // Reuse existing mic tracks — do NOT call getUserMedia again
      const audioStream = new MediaStream(micStreamRef.current.getAudioTracks());

      const socket = new WebSocket(
        'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
          model: 'nova-2',
          smart_format: 'true',
          punctuate: 'true',
          interim_results: 'true',
          endpointing: '300',
          utterance_end_ms: '1000',
          vad_events: 'true',
        }).toString(),
        ['token', key]
      );

      socket.onopen = () => {
        setIsListening(true);

        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
          .find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/mp4';

        const recorder = new MediaRecorder(audioStream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(e.data);
          }
        };
        recorder.start(250);
        sttRecorderRef.current = recorder;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const t = data.channel?.alternatives?.[0]?.transcript;
          if (!t?.trim()) return;

          if (data.is_final) {
            finalTranscriptRef.current = finalTranscriptRef.current
              ? finalTranscriptRef.current + ' ' + t
              : t;
            setTranscript(finalTranscriptRef.current);
          } else {
            setTranscript(
              finalTranscriptRef.current ? finalTranscriptRef.current + ' ' + t : t
            );
          }
        } catch { /* ignore */ }
      };

      socket.onclose = () => setIsListening(false);
      socket.onerror = () => setIsListening(false);
      deepgramSocketRef.current = socket;
    } catch {
      // Silently fail — candidate can still click Done Speaking manually
    }
  }, []);

  // ── Add to conversation ───────────────────────────────────────────────────
  const addToConversation = useCallback((role: 'interviewer' | 'candidate', text: string) => {
    const entry: ConversationEntry = { role, text };
    conversationRef.current = [...conversationRef.current, entry];
    setConversation([...conversationRef.current]);
  }, []);

  // ── Send candidate turn to AI and speak response ──────────────────────────
  const sendToAI = useCallback(async (text: string) => {
    if (!text.trim() || stageRef.current !== 'active') return;

    stopListening();
    addToConversation('candidate', text);
    finalTranscriptRef.current = '';
    setTranscript('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt,
          history: conversationRef.current,
          minutesElapsed: Math.floor(elapsedSeconds / 60),
        }),
      });
      if (!response.ok) throw new Error('AI failed');
      const { reply } = await response.json();

      const wantsToEnd = reply.includes('[END_INTERVIEW]');
      const cleanReply = reply.replace(/\[END_INTERVIEW\]/g, '').trim();

      addToConversation('interviewer', cleanReply);
      await speakText(cleanReply);

      if (wantsToEnd) {
        endInterviewRef.current?.();
        return;
      }
      await startListening();
    } catch {
      await startListening(); // resume listening even on error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopListening, addToConversation, speakText, startListening, systemPrompt, elapsedSeconds]);

  // ── End interview ─────────────────────────────────────────────────────────
  const endInterview = useCallback(async () => {
    if (stageRef.current === 'analyzing' || stageRef.current === 'ended') return;
    stageRef.current = 'analyzing';
    setStage('analyzing');

    speakCancelRef.current = true;
    stopListening();
    if (timerRef.current) clearInterval(timerRef.current);

    // Build transcript
    const now = new Date();
    let transcriptText = `INTERVIEW TRANSCRIPT\nCandidate: ${candidateName}\nPosition: ${jobTitle}\nDate: ${now.toLocaleDateString()}\nRound: 1\n\n`;
    for (const e of conversationRef.current) {
      const label = e.role === 'interviewer' ? 'Serena (Interviewer)' : `${candidateName} (Candidate)`;
      transcriptText += `${label}:\n${e.text}\n\n`;
    }

    try {
      await fetch('/api/end-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, transcript: transcriptText }),
      });
    } catch { /* non-fatal */ }

    // Stop recording and finalize
    const totalChunks = chunkIndexRef.current;
    if (recorderRef.current && isRecordingRef.current) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        recorderRef.current!.addEventListener('stop', () => { clearTimeout(timeout); resolve(); }, { once: true });
        recorderRef.current!.stop();
      });
      isRecordingRef.current = false;
    }

    // Stop all streams
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    recordingDestRef.current = null;

    // Upload & finalize recording
    if (totalChunks > 0) {
      try {
        setUploadProgress(10);
        await Promise.allSettled(pendingUploadsRef.current);
        setUploadProgress(50);

        await fetch('/api/finalize-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateId,
            round: 1,
            totalChunks,
            mimeType: recordingMimeRef.current,
          }),
        });
        setUploadProgress(100);
      } catch (err) {
        console.warn('[VoiceR1] Recording finalize failed (non-fatal):', err);
        setUploadProgress(100);
      }
    }

    if (chunkDBRef.current) {
      idbClearChunks(chunkDBRef.current).catch(() => {});
      chunkDBRef.current = null;
    }

    stageRef.current = 'ended';
    setStage('ended');
    if (totalChunks === 0) setUploadProgress(100);
  }, [candidateId, candidateName, jobTitle, stopListening]);

  // Keep endInterviewRef stable
  useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'active') return;
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => {
        const next = s + 1;
        if (next >= 2100) endInterviewRef.current?.(); // 35 min hard cutoff
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  // ── Prefetch welcome TTS on mount ─────────────────────────────────────────
  useEffect(() => {
    const welcome = `Hi ${firstName}, great to meet you! I'm Serena, your interviewer for the ${jobTitle} role at Printerpix. It's completely normal to feel a few butterflies — this is a new experience for most people. Today we'll focus on concrete examples from your experience. Take your time, think out loud if it helps, and ask me to repeat anything. Before we jump in, could you confirm that you can hear me clearly? Once you reply, please click the green Done Speaking button.`;
    const chunks = splitIntoTTSChunks(welcome);
    welcomePromisesRef.current = chunks.map(chunk =>
      fetch('/api/deepgram-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk }),
      }).then(r => {
        if (!r.ok) throw new Error('TTS prefetch failed');
        return r.blob();
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // ── Media check ───────────────────────────────────────────────────────────
  const micLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const checkAudioCtxRef = useRef<AudioContext | null>(null);

  const startMediaCheck = useCallback(async () => {
    setCameraError(false);
    setMicError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      checkStreamRef.current = stream;

      if (checkVideoRef.current) {
        checkVideoRef.current.srcObject = stream;
      }

      // Mic level analyser
      const ctx = new AudioContext();
      checkAudioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      micLevelIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicLevel(Math.min(100, avg * 2.5));
      }, 100);

      setMediaCheckDone(true);
    } catch {
      setCameraError(true);
      setMicError(true);
    }
  }, []);

  const stopMediaCheck = useCallback(() => {
    if (micLevelIntervalRef.current) clearInterval(micLevelIntervalRef.current);
    checkAudioCtxRef.current?.close();
    checkAudioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // ── Camera preview: attach stream once mediaCheckDone renders the <video> ─
  useEffect(() => {
    if (mediaCheckDone && checkVideoRef.current && checkStreamRef.current) {
      checkVideoRef.current.srcObject = checkStreamRef.current;
    }
  }, [mediaCheckDone]);

  // ── Upload recording chunk to server ─────────────────────────────────────
  const uploadChunk = (idx: number, chunk: Blob): Promise<void> => {
    const fd = new FormData();
    fd.append('candidateId', candidateId);
    fd.append('chunkIndex', String(idx));
    fd.append('round', '1');
    fd.append('mimeType', recordingMimeRef.current);
    fd.append('chunk', chunk, `chunk_${idx}.webm`);
    return fetch('/api/save-recording-chunk', { method: 'POST', body: fd })
      .then(() => {})
      .catch(() => {});
  };

  // ── Screen share ──────────────────────────────────────────────────────────
  const requestScreenShare = useCallback(async () => {
    setScreenError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
        audio: true,
      });
      // End interview if candidate stops screen share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        endInterviewRef.current?.();
      });
      screenStreamRef.current = stream;
      setScreenShared(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('cancelled') && !msg.includes('Permission denied')) {
        setScreenError('Screen sharing failed. Please try again and select a monitor.');
      }
    }
  }, []);

  // ── Start interview ───────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setStage('starting');
    stageRef.current = 'starting';
    setSetupError(null);

    try {
      stopMediaCheck();

      // Acquire mic stream for the interview (reuse check stream if possible)
      const micStream = checkStreamRef.current
        ? new MediaStream(checkStreamRef.current.getAudioTracks())
        : await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      setStage('active');
      stageRef.current = 'active';

      // ── Start recording: screen video + mic + TTS audio ───────────────────
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();
        recordingDestRef.current = dest;

        // Route mic through AudioContext destination
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);

        // Also add screen audio if present
        const screenAudioTracks = screenStreamRef.current?.getAudioTracks() ?? [];
        if (screenAudioTracks.length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks));
          sysSource.connect(dest);
        }

        // Build combined stream: screen video + mixed audio
        const videoTracks = screenStreamRef.current?.getVideoTracks() ?? [];
        const recordingStream = new MediaStream([...videoTracks, ...dest.stream.getAudioTracks()]);

        const db = await idbOpen();
        await idbClearChunks(db);
        chunkDBRef.current = db;
        chunkIndexRef.current = 0;
        pendingUploadsRef.current = [];

        // Pick mimeType based on whether video tracks are available.
        // Using a video/* mimeType with an audio-only stream produces 0-byte chunks.
        const mimeType = videoTracks.length > 0
          ? (['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
              .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm')
          : (['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
              .find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm');
        recordingMimeRef.current = mimeType;

        const recorder = new MediaRecorder(recordingStream, { mimeType });
        recorder.ondataavailable = async (e) => {
          if (e.data?.size > 0) {
            const idx = chunkIndexRef.current++;
            if (chunkDBRef.current) {
              try { await idbSaveChunk(chunkDBRef.current, e.data); } catch { /* ignore */ }
            }
            pendingUploadsRef.current.push(uploadChunk(idx, e.data));
          }
        };
        recorderRef.current = recorder;
        recorder.start(30_000); // 30s chunks
        isRecordingRef.current = true;
      } catch (recErr) {
        console.warn('[VoiceR1] Recording setup failed (non-fatal):', recErr);
      }

      // Play welcome TTS (pre-fetched on mount — instant or near-instant)
      const welcomeText = `Hi ${firstName}, great to meet you! I'm Serena, your interviewer for the ${jobTitle} role at Printerpix. It's completely normal to feel a few butterflies — this is a new experience for most people. Today we'll focus on concrete examples from your experience. Take your time, think out loud if it helps, and ask me to repeat anything. Before we jump in, could you confirm that you can hear me clearly? Once you reply, please click the green Done Speaking button.`;
      addToConversation('interviewer', welcomeText);

      isSpeakingRef.current = true;
      speakCancelRef.current = false;
      setIsSpeaking(true);
      setSubtitle(welcomeText);

      const promises = welcomePromisesRef.current ?? [];
      for (const p of promises) {
        if (speakCancelRef.current) break;
        try {
          const blob = await p;
          if (speakCancelRef.current) break;
          await playBlob(blob);
        } catch { break; }
      }

      isSpeakingRef.current = false;
      setIsSpeaking(false);
      await startListening();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start interview';
      setSetupError(msg);
      setStage('setup');
      stageRef.current = 'setup';
    }
  }, [stopMediaCheck, addToConversation, playBlob, startListening, firstName, jobTitle]);

  // ── Attach camera stream once active stage has rendered ──────────────────
  useEffect(() => {
    if (stage === 'active' && camVideoRef.current && checkStreamRef.current) {
      camVideoRef.current.srcObject = checkStreamRef.current;
    }
  }, [stage]);

  // ── Done Speaking nudge: pulse + tooltip after 5s of unsubmitted transcript ─
  const [showDoneSpeakingHint, setShowDoneSpeakingHint] = useState(false);

  useEffect(() => {
    if (isListening && !isSpeaking && transcript.trim()) {
      const timer = setTimeout(() => setShowDoneSpeakingHint(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowDoneSpeakingHint(false);
    }
  }, [isListening, isSpeaking, transcript]);

  // ── Done Speaking button ──────────────────────────────────────────────────
  const handleDoneSpeaking = useCallback(() => {
    const text = finalTranscriptRef.current.trim();
    if (!text || isSpeakingRef.current) return;
    setShowDoneSpeakingHint(false);
    sendToAI(text);
  }, [sendToAI]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      stopMediaCheck();
      checkStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopListening, stopMediaCheck]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const micFeedback      = micLevel < 10 ? 'Too quiet' : micLevel <= 50 ? 'Good' : 'Great!';
  const micFeedbackColor = micLevel < 10 ? 'text-yellow-400' : 'text-emerald-400';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Setup screen ─────────────────────────────────────────────────── */}
      {stage === 'setup' && (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            {/* Logo */}
            <div className="text-center mb-8">
              <Image src="/logo.jpg" alt="Printerpix" width={56} height={56} className="rounded-xl mx-auto mb-4" />
            </div>

            {/* Welcome heading */}
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
              Welcome, <span className="text-cyan-400">{firstName}</span>, to your interview for the{' '}
              <span className="text-cyan-400">{jobTitle}</span> role at Printerpix.
            </h1>

            {/* Instructions */}
            <div className="bg-card/80 border border-border rounded-2xl p-6 sm:p-8 mb-8">
              <p className="text-muted-foreground text-sm mb-5">
                This is a 30-minute voice interview. Please keep the following in mind:
              </p>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Screen sharing required:</strong> You will be asked to share your full screen before the interview begins. Please select a <strong className="text-foreground">monitor</strong>, not a window or tab.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Secure a strong connection:</strong> We record this conversation for our team to review. A stable internet connection ensures your answers are captured in high quality.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Speak clearly:</strong> Find a quiet space and speak at a strong, conversational volume.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Done Speaking button:</strong> After finishing each answer, click the green <strong className="text-foreground">Done Speaking</strong> button so Serena can respond.</span>
                </li>
              </ul>
            </div>

            {/* Camera preview + mic level */}
            {mediaCheckDone && (
              <div className="mb-6 space-y-4">
                <div className="mx-auto w-64 h-48 rounded-xl overflow-hidden border-2 border-border bg-card flex items-center justify-center">
                  {cameraError ? (
                    <div className="text-center text-red-400">
                      <CameraOff className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-sm font-medium">Camera required</p>
                    </div>
                  ) : (
                    <video ref={checkVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  )}
                </div>
                {micError ? (
                  <div className="flex items-center justify-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Microphone required — please allow access and try again</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 max-w-xs mx-auto">
                    <Mic className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-75" style={{ width: `${micLevel}%` }} />
                    </div>
                    <span className={`text-sm font-medium w-16 text-right ${micFeedbackColor}`}>{micFeedback}</span>
                  </div>
                )}
              </div>
            )}

            {(screenError || setupError) && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400">{screenError || setupError}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col items-center gap-3">
              {!mediaCheckDone ? (
                <button
                  onClick={startMediaCheck}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
                >
                  Check Camera &amp; Mic
                </button>
              ) : !screenShared ? (
                <button
                  onClick={requestScreenShare}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25 flex items-center gap-3"
                >
                  <Monitor className="w-5 h-5" />
                  Share Screen to Begin
                </button>
              ) : (
                <button
                  onClick={startInterview}
                  disabled={cameraError || micError}
                  className={`px-8 py-4 text-white text-lg font-semibold rounded-xl transition-all transform shadow-lg ${
                    cameraError || micError
                      ? 'bg-muted cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 shadow-cyan-500/25'
                  }`}
                >
                  Start Interview with Serena
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Starting ─────────────────────────────────────────────────────── */}
      {stage === 'starting' && (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
            <p className="text-foreground text-lg">Connecting to Serena...</p>
          </div>
        </div>
      )}

      {/* ── Active interview ─────────────────────────────────────────────── */}
      {stage === 'active' && (
        <div className="h-screen bg-[#080810] flex overflow-hidden">

          {/* LEFT: Serena voice indicator */}
          <div className="relative flex-1 bg-[#080810] flex flex-col items-center justify-center overflow-hidden">
            {/* Recording + timer badge row */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                RECORDING
              </div>
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/80 text-sm font-mono px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            {/* Serena avatar — animated pulse rings when speaking */}
            <div className="relative flex items-center justify-center mb-8">
              {isSpeaking && (
                <>
                  <div className="absolute w-48 h-48 rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute w-40 h-40 rounded-full border border-cyan-500/30 animate-ping" style={{ animationDuration: '1.5s' }} />
                </>
              )}
              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSpeaking
                  ? 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border-2 border-cyan-400/60 shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 border-2 border-white/10'
              }`}>
                <span className="text-5xl">👩‍💼</span>
              </div>
            </div>

            {/* Serena label */}
            <div className="text-center mb-6">
              <h2 className="text-white font-bold text-xl">Serena</h2>
              <p className="text-cyan-400/80 text-sm">AI Talent Scout · Printerpix</p>
            </div>

            {/* Current speech / status */}
            <div className="max-w-lg w-full mx-auto px-8">
              <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-5 border border-white/10 min-h-[80px] flex flex-col justify-center">
                {isSpeaking ? (
                  <>
                    <p className="text-white/90 text-base leading-relaxed italic text-center">&ldquo;{subtitle}&rdquo;</p>
                    <div className="flex items-center justify-center gap-1 mt-3">
                      {[3,5,8,6,4,7,5,3].map((h, i) => (
                        <div key={i} className="w-1 bg-cyan-400 rounded-full animate-pulse"
                          style={{ height: `${h * 2}px`, animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  </>
                ) : isListening ? (
                  <p className="text-white/50 text-sm text-center">Listening to {firstName}...</p>
                ) : (
                  <p className="text-white/30 text-sm text-center">—</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="w-[360px] shrink-0 bg-[#0d0d1a] border-l border-white/10 flex flex-col">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Round 1 — Personality Interview</h2>
              <p className="text-xs text-cyan-400/80 mt-0.5">Serena · AI Talent Scout</p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Candidate camera */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                <video ref={camVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                  <span className="text-white/70 text-xs">You</span>
                </div>
              </div>

              {/* Mic level */}
              {isListening && (
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-75" style={{ width: `${micLevel}%` }} />
                  </div>
                </div>
              )}

              {/* Current transcript */}
              {(isListening || transcript) && (
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-white/40 font-medium mb-1 uppercase tracking-wider">You</p>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {transcript || <span className="text-white/30 italic">Listening...</span>}
                  </p>
                </div>
              )}

              {/* Conversation history */}
              <div className="space-y-3">
                {[...conversation].reverse().slice(0, 6).reverse().map((entry, i) => (
                  <div key={i} className={`rounded-xl p-3 ${
                    entry.role === 'interviewer'
                      ? 'bg-cyan-500/10 border border-cyan-500/20'
                      : 'bg-white/5 border border-white/10'
                  }`}>
                    <p className="text-xs font-medium mb-1 uppercase tracking-wider text-white/40">
                      {entry.role === 'interviewer' ? 'Serena' : 'You'}
                    </p>
                    <p className="text-white/75 text-sm leading-relaxed line-clamp-4">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Done Speaking button */}
            <div className="px-5 pb-5 pt-3 border-t border-white/10">
              <div className="relative">
                {showDoneSpeakingHint && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10">
                    <div className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                      Done speaking? Click here ↓
                    </div>
                    <div className="w-2 h-2 bg-emerald-500 rotate-45 -mt-1" />
                  </div>
                )}
                <button
                  onClick={handleDoneSpeaking}
                  disabled={!isListening || isSpeaking || !transcript.trim()}
                  className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all ${
                    isListening && !isSpeaking && transcript.trim()
                      ? `bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30 ${showDoneSpeakingHint ? 'animate-pulse' : ''}`
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {isSpeaking ? 'Serena is speaking...' : isListening ? 'Done Speaking' : 'Waiting...'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Analyzing / Ended ────────────────────────────────────────────── */}
      {(stage === 'analyzing' || stage === 'ended') && (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            {stage === 'analyzing' ? (
              <>
                <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">Wrapping Up</h2>
                <p className="text-muted-foreground">Saving your session...</p>
                {uploadProgress !== null && uploadProgress < 100 && (
                  <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">✓</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Interview Complete</h2>
                <p className="text-muted-foreground mb-2">Thank you, {firstName}. Your session has been submitted.</p>
                <p className="text-muted-foreground/70 text-sm">Our team will review your responses and be in touch soon.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Connection error ─────────────────────────────────────────────── */}
      {stage === 'connection-error' && (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Connection Error</h2>
            <p className="text-muted-foreground mb-6">Unable to connect. Please check your internet connection and try again.</p>
            <button onClick={() => { setStage('setup'); stageRef.current = 'setup'; }}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition-colors">
              Try Again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
