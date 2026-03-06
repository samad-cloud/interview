'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Loader2, Monitor, AlertCircle, Clock, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { Round3Dossier } from '@/app/actions/generateRound3Dossier';

// ── IndexedDB helpers (same pattern as VoiceAvatar) ──────────────────────────
const IDB_NAME  = 'avatar-recording-chunks';
const IDB_STORE = 'chunks';

function openChunkDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE))
        req.result.createObjectStore(IDB_STORE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function idbSaveChunk(db: IDBDatabase, chunk: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add(chunk);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
function idbClearChunks(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

interface AvatarInterviewProps {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  dossier: Round3Dossier | null;
}

type Stage = 'screen-setup' | 'ready' | 'starting' | 'active' | 'analyzing' | 'ended';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Estimate how long it takes the avatar to speak text (ms)
function estimateSpeakDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2500, (words / 2.5) * 1000 + 1500); // ~150 wpm + 1.5s buffer
}

// Format seconds as MM:SS
function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function AvatarInterview({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  dossier,
}: AvatarInterviewProps) {
  const [stage, setStage] = useState<Stage>('screen-setup');
  const [screenError, setScreenError] = useState<string | null>(null);
  const [bithumanToken, setBithumanToken] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusText, setStatusText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [camReady, setCamReady] = useState(false);

  // Streams & recording
  const screenStreamRef    = useRef<MediaStream | null>(null);
  const camStreamRef       = useRef<MediaStream | null>(null);
  const recorderRef        = useRef<MediaRecorder | null>(null);
  const chunkDBRef         = useRef<IDBDatabase | null>(null);
  const chunkIndexRef      = useRef(0);
  const pendingUploadsRef  = useRef<Promise<void>[]>([]);
  const isRecordingRef     = useRef(false);
  const recordingMimeRef   = useRef('video/webm');

  // Deepgram
  const deepgramSocketRef  = useRef<WebSocket | null>(null);
  const micRecorderRef     = useRef<MediaRecorder | null>(null);

  // Gemini conversation
  const historyRef         = useRef<ConversationMessage[]>([]);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  // Avatar session
  const roomIdRef          = useRef<string | undefined>(undefined);
  const speakCancelledRef  = useRef(false);

  // Timers
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI refs
  const camVideoRef        = useRef<HTMLVideoElement>(null);
  const endInterviewCalledRef = useRef(false);

  // ── Screen share request & validation ───────────────────────────────────────
  const requestScreenShare = async () => {
    setScreenError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings() as MediaTrackSettings & { displaySurface?: string };

      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        stream.getTracks().forEach(t => t.stop());
        setScreenError('Please share your entire screen — not a window or browser tab. Click "Share Screen" again and select a monitor from the list.');
        return;
      }

      // Listen for user stopping share
      videoTrack.addEventListener('ended', () => {
        if (stage === 'active') endInterview();
      });

      screenStreamRef.current = stream;
      setStage('ready');
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        setScreenError('Screen sharing is required to proceed. Please allow screen sharing when prompted.');
      }
    }
  };

  // ── Start interview ──────────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setStage('starting');

    try {
      // 1. Cam + mic
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      camStreamRef.current = camStream;
      if (camVideoRef.current) {
        camVideoRef.current.srcObject = camStream;
        camVideoRef.current.muted = true; // no echo
      }
      setCamReady(true);

      // 2. Build combined recording stream: screen video + mixed audio
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      // Mic audio
      const micSource = audioCtx.createMediaStreamSource(camStream);
      micSource.connect(dest);

      // System audio from screen share (if captured — works on Chrome/Windows)
      const screenAudioTracks = screenStreamRef.current?.getAudioTracks() ?? [];
      if (screenAudioTracks.length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(
          new MediaStream(screenAudioTracks)
        );
        sysSource.connect(dest);
      }

      const screenVideoTrack = screenStreamRef.current!.getVideoTracks()[0];
      const recordingStream = new MediaStream([
        screenVideoTrack,
        ...dest.stream.getAudioTracks(),
      ]);

      // 3. Init recording
      const db = await openChunkDB();
      await idbClearChunks(db);
      chunkDBRef.current = db;
      chunkIndexRef.current = 0;
      pendingUploadsRef.current = [];

      const mimeType = (['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t))) ?? 'video/webm';
      recordingMimeRef.current = mimeType;

      const recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 1_000_000 });
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
      recorder.start(30_000);
      isRecordingRef.current = true;

      // 4. Get BitHuman token
      const tokenRes = await fetch('/api/bithuman-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error('Failed to get avatar token');
      setBithumanToken(tokenData.token);
      if (tokenData.sid) roomIdRef.current = tokenData.sid;

      // 5. Start Deepgram STT
      await startDeepgram(camStream);

      // 6. Update candidate status
      await supabase
        .from('candidates')
        .update({ round_3_status: 'IN_PROGRESS', current_stage: 'round_3' })
        .eq('id', candidateId);

      setStage('active');

      // 7. Start timer
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

      // 8. Build system prompt from dossier
      const systemPrompt = buildSystemPrompt();

      // 9. Welcome message (after brief delay to let iframe load)
      setTimeout(async () => {
        const welcome = `Hello ${candidateName.split(' ')[0]}, thank you for joining us for the final stage of your interview. I've had a chance to review your previous conversations with our team, and today we're going to go much deeper. This session will be about 40 minutes. Let's begin — can you start by giving me a brief overview of your background?`;
        await avatarSpeak(welcome, systemPrompt);
      }, 3000);

    } catch (err) {
      console.error('[AvatarInterview] Start failed:', err);
      setStage('ready');
      setScreenError('Failed to start interview. Please try again.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, candidateName, dossier]);

  // ── System prompt from dossier ───────────────────────────────────────────────
  const buildSystemPrompt = useCallback((): string => {
    const probeSection = dossier?.probeAreas.map((a, i) =>
      `${i + 1}. [${a.priority.toUpperCase()}] ${a.topic}\n   Context: ${a.context}\n   Why probe: ${a.whyProbe}\n   Angles: ${a.suggestedAngles.join(' | ')}`
    ).join('\n\n') ?? 'Assess the candidate thoroughly based on their stated experience and the job requirements.';

    const redFlagsSection = dossier?.redFlags.length
      ? `\nRED FLAGS TO ADDRESS:\n${dossier.redFlags.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
      : '';

    return `=== YOUR IDENTITY ===
NAME: Atlas
ROLE: Senior Interviewer, Final Vetting Round at Printerpix.
VIBE: You are thorough, precise, and impossible to bluff. You have read every word this candidate has said in their previous two interviews. You are warm but relentless — you WILL find out what they actually know.

=== THE CANDIDATE ===
NAME: ${candidateName}
JOB: ${jobTitle}
${jobDescription ? `DESCRIPTION: ${jobDescription.substring(0, 500)}` : ''}

=== CANDIDATE RESUME ===
${resumeText?.substring(0, 800) || 'Not provided'}

=== YOUR MISSION ===
${dossier?.interviewerBrief ?? 'Conduct a thorough deep-dive interview to verify the candidate\'s claims and assess their true depth of knowledge.'}

=== PROBE AREAS (in priority order) ===
${probeSection}
${redFlagsSection}

=== INTERVIEW RULES ===
1. Work through the probe areas systematically — do not skip any HIGH priority items.
2. When they give a surface answer, push deeper immediately: "Walk me through exactly how you did that."
3. Test for real understanding: ask about tradeoffs, failures, alternative approaches.
4. If an answer contradicts what they said before, surface it directly but professionally.
5. Do NOT accept buzzwords — ask them to explain every technical term they use.
6. NEVER pretend to be the candidate. You are Atlas. You ask questions.
7. After 2 follow-up probes on any topic, move to the next probe area — breadth matters.

=== TOPIC BREADTH & DEPTH BALANCE ===
You must cover all HIGH priority probe areas before the interview ends.
RULE: Max 2 follow-up probes per topic before moving on. A 3rd is allowed only if the answer was clearly evasive or contradictory — once per topic maximum.
PRIORITY: Missing a probe area entirely is worse than leaving one topic slightly unexplored.

=== INTERVIEW DURATION ===
This interview lasts 40 minutes. Pace yourself to cover all probe areas.
At the 38-minute mark, wrap up with: "${candidateName.split(' ')[0]}, we're coming to the end of our time. You've given me a detailed picture today. Our team will be in touch with final decisions. Thank you for your patience through this thorough process — take care! [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end.`;
  }, [candidateName, jobTitle, jobDescription, resumeText, dossier]);

  // ── Deepgram STT ─────────────────────────────────────────────────────────────
  const startDeepgram = async (camStream: MediaStream) => {
    const keyRes = await fetch('/api/deepgram');
    const { key } = await keyRes.json();

    const socket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?encoding=webm-opus&model=nova-2&language=en-US&smart_format=true&interim_results=true&endpointing=400&utterance_end_ms=1200&vad_events=true`,
      ['token', key]
    );

    socket.onopen = () => {
      const sttMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/mp4';
      const micRecorder = new MediaRecorder(
        new MediaStream(camStream.getAudioTracks()),
        { mimeType: sttMime }
      );
      micRecorder.ondataavailable = (e) => {
        if (socket.readyState === WebSocket.OPEN && e.data.size > 0)
          socket.send(e.data);
      };
      micRecorder.start(250);
      micRecorderRef.current = micRecorder;
      setIsListening(true);
    };

    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;
          const text = alt.transcript ?? '';
          const isFinal = data.is_final;
          if (isFinal && text.trim()) {
            finalTranscriptRef.current += ' ' + text;
            interimTranscriptRef.current = '';
            setTranscript(finalTranscriptRef.current.trim());
          } else if (!isFinal) {
            interimTranscriptRef.current = text;
          }
        } else if (data.type === 'UtteranceEnd') {
          const full = (finalTranscriptRef.current + ' ' + interimTranscriptRef.current).trim();
          if (full.length > 2 && !isSpeaking) {
            finalTranscriptRef.current = '';
            interimTranscriptRef.current = '';
            setTranscript('');
            handleCandidateUtterance(full);
          }
        }
      } catch { /* ignore parse errors */ }
    };

    socket.onerror = (e) => console.error('[Deepgram] Error:', e);
    deepgramSocketRef.current = socket;
  };

  // ── Handle candidate speech → Gemini → avatar speak ─────────────────────────
  const handleCandidateUtterance = useCallback(async (text: string) => {
    if (stage !== 'active' || isSpeaking) return;
    setStatusText('Thinking...');

    const systemPrompt = buildSystemPrompt();

    // Add to history
    historyRef.current.push({ role: 'user', content: text });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt,
          history: historyRef.current.slice(-12), // keep last 12 turns
        }),
      });

      const data = await res.json();
      const reply: string = data.response || data.message || '';

      if (reply) {
        historyRef.current.push({ role: 'assistant', content: reply });
        await avatarSpeak(reply, systemPrompt);

        // Check for end signal
        if (reply.includes('[END_INTERVIEW]')) {
          setTimeout(() => endInterview(), 2000);
        }
      }
    } catch (err) {
      console.error('[AvatarInterview] Gemini error:', err);
      setStatusText('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isSpeaking, buildSystemPrompt]);

  // ── Avatar speak via BitHuman ────────────────────────────────────────────────
  const avatarSpeak = async (text: string, _systemPrompt?: string) => {
    speakCancelledRef.current = false;
    setIsSpeaking(true);
    setIsListening(false);
    setStatusText('');

    // Pause Deepgram mic while avatar speaks
    if (micRecorderRef.current?.state === 'recording') {
      micRecorderRef.current.pause();
    }

    try {
      await fetch('/api/avatar-speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.replace('[END_INTERVIEW]', ''), roomId: roomIdRef.current }),
      });
    } catch (err) {
      console.error('[AvatarInterview] avatar-speak failed:', err);
    }

    // Estimate speaking duration then resume listening
    const duration = estimateSpeakDuration(text);
    speakTimeoutRef.current = setTimeout(() => {
      if (speakCancelledRef.current) return;
      setIsSpeaking(false);
      setIsListening(true);
      if (micRecorderRef.current?.state === 'paused') {
        micRecorderRef.current.resume();
      }
    }, duration);
  };

  // ── Upload chunk ─────────────────────────────────────────────────────────────
  const uploadChunk = (idx: number, chunk: Blob): Promise<void> => {
    const fd = new FormData();
    fd.append('candidateId', candidateId);
    fd.append('chunkIndex', String(idx));
    fd.append('round', '3');
    fd.append('mimeType', recordingMimeRef.current);
    fd.append('chunk', chunk, `chunk_${idx}.webm`);
    return fetch('/api/save-recording-chunk', { method: 'POST', body: fd })
      .then(() => {})
      .catch(() => {});
  };

  // ── End interview ────────────────────────────────────────────────────────────
  const endInterview = useCallback(async () => {
    if (endInterviewCalledRef.current) return;
    endInterviewCalledRef.current = true;

    setIsSubmitting(true);
    setStage('analyzing');

    // Clear timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

    // Stop Deepgram
    if (micRecorderRef.current?.state !== 'inactive') micRecorderRef.current?.stop();
    if (deepgramSocketRef.current?.readyState === WebSocket.OPEN) deepgramSocketRef.current.close();

    // Stop recording
    const totalChunks = chunkIndexRef.current;
    if (recorderRef.current && isRecordingRef.current) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        recorderRef.current!.addEventListener('stop', () => { clearTimeout(timeout); resolve(); }, { once: true });
        recorderRef.current!.stop();
      });
      isRecordingRef.current = false;
    }

    // Stop streams
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current?.getTracks().forEach(t => t.stop());

    // Build transcript from history
    const fullTranscript = historyRef.current
      .map(m => `${m.role === 'user' ? candidateName : 'Atlas'}: ${m.content}`)
      .join('\n\n');

    if (totalChunks > 0) {
      try {
        setUploadProgress(10);
        await Promise.allSettled(pendingUploadsRef.current);
        setUploadProgress(50);

        await fetch('/api/finalize-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateId: parseInt(candidateId),
            round: 3,
            chunkCount: totalChunks,
            mimeType: recordingMimeRef.current,
          }),
        });
        setUploadProgress(80);
      } catch {
        // Non-fatal — chunks are in Supabase for manual recovery
      }
    }

    // Store transcript and trigger scoring
    try {
      await fetch('/api/end-round3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, transcript: fullTranscript }),
      });
    } catch (err) {
      console.error('[AvatarInterview] end-round3 failed:', err);
    }

    if (chunkDBRef.current) {
      idbClearChunks(chunkDBRef.current).catch(() => {});
      chunkDBRef.current = null;
    }

    setUploadProgress(null);
    setStage('ended');
    setIsSubmitting(false);
  }, [candidateId, candidateName]);

  // ── Hard cutoff at 55 minutes ────────────────────────────────────────────────
  useEffect(() => {
    if (elapsedSeconds === 3300 && stage === 'active') endInterview();
  }, [elapsedSeconds, stage, endInterview]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      if (deepgramSocketRef.current?.readyState === WebSocket.OPEN) deepgramSocketRef.current.close();
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Render: Screen Setup ─────────────────────────────────────────────────────
  if (stage === 'screen-setup' || stage === 'ready') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
              <Monitor className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Round 3 — Final Interview</h1>
              <p className="text-sm text-muted-foreground">{jobTitle}</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <p className="text-foreground">
              Before we begin, you need to <strong>share your entire screen</strong>. This allows us to record the session and ensure a fair process.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">1</span>
                Click "Share Screen" below
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">2</span>
                Select <strong>Entire Screen</strong> (not a window or tab)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">3</span>
                Click Share in the browser prompt
              </li>
            </ul>
          </div>

          {screenError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{screenError}</p>
            </div>
          )}

          {stage === 'ready' && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm text-emerald-400">Screen sharing active — your entire screen is ready</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {stage === 'screen-setup' && (
              <button
                onClick={requestScreenShare}
                className="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                Share Screen
              </button>
            )}

            {stage === 'ready' && (
              <>
                <button
                  onClick={startInterview}
                  className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Start Interview
                </button>
                <button
                  onClick={requestScreenShare}
                  className="w-full py-2 px-4 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                >
                  Re-share screen
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            This session is approximately 40 minutes. Find a quiet place with good lighting.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Starting ─────────────────────────────────────────────────────────
  if (stage === 'starting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Setting up your interview...</p>
          <p className="text-muted-foreground text-sm mt-2">Starting avatar session</p>
        </div>
      </div>
    );
  }

  // ── Render: Analyzing / Ended ────────────────────────────────────────────────
  if (stage === 'analyzing' || stage === 'ended') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          {stage === 'analyzing' ? (
            <>
              <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Wrapping Up</h2>
              <p className="text-muted-foreground">Saving your session and submitting responses...</p>
              {uploadProgress !== null && (
                <div className="mt-6">
                  <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{uploadProgress}%</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">✓</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Interview Complete</h2>
              <p className="text-muted-foreground mb-2">
                Thank you, {candidateName.split(' ')[0]}. Your session has been submitted.
              </p>
              <p className="text-muted-foreground/70 text-sm">
                Our team will review your responses from all three rounds and be in touch soon.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Active interview ─────────────────────────────────────────────────
  const wrapUpAt = 2280; // 38 min
  const timeRemaining = Math.max(0, wrapUpAt - elapsedSeconds);
  const isNearEnd = elapsedSeconds >= wrapUpAt - 300; // last 5 min

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isRecordingRef.current ? 'bg-red-500 animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm text-muted-foreground font-medium">Round 3 — {jobTitle}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-mono ${isNearEnd ? 'text-amber-400' : 'text-muted-foreground'}`}>
          <Clock className="w-3.5 h-3.5" />
          {formatTime(elapsedSeconds)}
        </div>
        <button
          onClick={endInterview}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400 transition-colors border border-border hover:border-red-500/50 rounded-md px-3 py-1"
        >
          <X className="w-3.5 h-3.5" />
          End
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Avatar iframe */}
        <div className="relative flex-1">
          {bithumanToken ? (
            <iframe
              src={`https://agent.viewer.bithuman.ai/${process.env.NEXT_PUBLIC_BITHUMAN_AGENT_ID ?? 'A46JXE7400'}?token=${bithumanToken}`}
              className="w-full h-full border-0"
              allow="camera; microphone; autoplay"
              title="AI Interviewer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/10">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          )}

          {/* Candidate cam PiP — bottom right */}
          <div className="absolute bottom-4 right-4 w-36 h-24 rounded-xl overflow-hidden border-2 border-border shadow-xl bg-card">
            <video
              ref={camVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${camReady ? 'opacity-100' : 'opacity-0'}`}
            />
            {!camReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 border-l border-border bg-card/30 flex flex-col p-4 gap-4 shrink-0">
          {/* Status */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <>
                  <div className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1 bg-cyan-400 rounded-full animate-pulse" style={{ height: `${12 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-sm text-cyan-400">Atlas is speaking</span>
                </>
              ) : isListening ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-emerald-400">Listening...</span>
                </>
              ) : statusText ? (
                <>
                  <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                  <span className="text-sm text-muted-foreground">{statusText}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">You said</p>
              <p className="text-sm text-foreground bg-muted/30 rounded-lg p-2 leading-relaxed">
                {transcript}
              </p>
            </div>
          )}

          {/* Mic indicator */}
          <div className="mt-auto">
            <div className={`flex items-center gap-2 text-sm p-2 rounded-lg ${isListening ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/20 text-muted-foreground'}`}>
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {isListening ? 'Microphone active' : 'Microphone paused'}
            </div>
            {isNearEnd && (
              <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                <p className="text-xs text-amber-400">Interview wrapping up soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
