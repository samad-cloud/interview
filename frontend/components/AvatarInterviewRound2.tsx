'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
} from 'livekit-client';
import { Mic, Loader2, Monitor, Clock, PhoneOff, AlertTriangle, AlertCircle, CameraOff } from 'lucide-react';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
const IDB_NAME  = 'avatar-r2-recording-chunks';
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

interface AvatarInterviewRound2Props {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  dossier?: string[];       // Round 1 probe questions
  r2Rubric?: string;
  round1Score?: number | null;
}

type Stage = 'setup' | 'starting' | 'active' | 'analyzing' | 'ended' | 'incomplete' | 'connection-error';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function AvatarInterviewRound2({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  dossier,
  r2Rubric,
  round1Score,
}: AvatarInterviewRound2Props) {
  const [stage, setStage]                   = useState<Stage>('setup');
  const [screenError, setScreenError]       = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [isListening, setIsListening]       = useState(false);
  const [statusText, setStatusText]         = useState('Connecting Nova...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [camReady, setCamReady]             = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [lastAgentText, setLastAgentText]   = useState('');
  const [agentTurnCount, setAgentTurnCount] = useState(0);

  // Pre-interview setup state
  const [mediaCheckDone, setMediaCheckDone] = useState(false);
  const [screenShared, setScreenShared]     = useState(false);
  const [micLevel, setMicLevel]             = useState(0);
  const [cameraError, setCameraError]       = useState(false);
  const [micError, setMicError]             = useState(false);

  // Streams & recording
  const screenStreamRef    = useRef<MediaStream | null>(null);
  const camStreamRef       = useRef<MediaStream | null>(null);
  const recorderRef        = useRef<MediaRecorder | null>(null);
  const chunkDBRef         = useRef<IDBDatabase | null>(null);
  const chunkIndexRef      = useRef(0);
  const pendingUploadsRef  = useRef<Promise<void>[]>([]);
  const isRecordingRef     = useRef(false);
  const recordingMimeRef   = useRef('video/webm');

  // Media check refs
  const checkVideoRef        = useRef<HTMLVideoElement>(null);
  const checkStreamRef       = useRef<MediaStream | null>(null);
  const checkAudioCtxRef     = useRef<AudioContext | null>(null);
  const checkAnalyserRef     = useRef<AnalyserNode | null>(null);
  const checkAnimFrameRef    = useRef<number>(0);

  // LiveKit
  const roomRef           = useRef<Room | null>(null);
  const agentVideoRef     = useRef<HTMLVideoElement>(null);
  const agentVideoBgRef   = useRef<HTMLVideoElement>(null);
  const agentAudioRef     = useRef<HTMLAudioElement>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const recordingDestRef  = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Transcript — formatted to match end-interview-round2 validation
  const transcriptRef     = useRef<string>('');

  // Pending tracks received before elements are mounted (race condition guard)
  const pendingVideoTrackRef  = useRef<Track | null>(null);
  const pendingAudioTrackRef  = useRef<Track | null>(null);

  // Timers & cleanup
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const camVideoRef           = useRef<HTMLVideoElement>(null);
  const endInterviewCalledRef = useRef(false);
  const roomNameRef           = useRef<string>('');

  // Attach check stream to preview video after media check completes
  useEffect(() => {
    if (mediaCheckDone && !cameraError && checkVideoRef.current && checkStreamRef.current) {
      checkVideoRef.current.srcObject = checkStreamRef.current;
    }
  }, [mediaCheckDone, cameraError]);

  // Re-attach any tracks that arrived before the elements mounted (race condition guard)
  useEffect(() => {
    if (stage === 'active') {
      if (pendingVideoTrackRef.current) {
        if (agentVideoRef.current) pendingVideoTrackRef.current.attach(agentVideoRef.current);
        if (agentVideoBgRef.current) pendingVideoTrackRef.current.attach(agentVideoBgRef.current);
        pendingVideoTrackRef.current = null;
        setAgentConnected(true);
      }
      if (pendingAudioTrackRef.current) {
        if (agentAudioRef.current) {
          pendingAudioTrackRef.current.attach(agentAudioRef.current);
          agentAudioRef.current.play().catch(() => {});
        }
        pendingAudioTrackRef.current = null;
      }
      if (camVideoRef.current && camStreamRef.current) {
        camVideoRef.current.srcObject = camStreamRef.current;
      }
    }
  }, [stage]);

  // Stop mic analyser when leaving setup stage
  const stopMediaCheck = useCallback(() => {
    if (checkAnimFrameRef.current) cancelAnimationFrame(checkAnimFrameRef.current);
    checkAudioCtxRef.current?.close().catch(() => {});
    checkAudioCtxRef.current = null;
    checkAnalyserRef.current = null;
    // Don't stop checkStream here — startInterview reuses it
  }, []);

  // ── Pre-interview: camera + mic check ────────────────────────────────────
  const startMediaCheck = async () => {
    setCameraError(false);
    setMicError(false);
    setScreenError(null);

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setCameraError(true);
      } catch {
        setMicError(true);
        setCameraError(true);
        setMediaCheckDone(true);
        return;
      }
    }

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      checkStreamRef.current = stream;
    } else {
      setCameraError(true);
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      try {
        const audioCtx = new AudioContext();
        checkAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        checkAnalyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          checkAnimFrameRef.current = requestAnimationFrame(tick);
        };
        checkAnimFrameRef.current = requestAnimationFrame(tick);
      } catch {
        setMicError(true);
      }
    } else {
      setMicError(true);
    }

    setMediaCheckDone(true);
  };

  // ── Screen share ─────────────────────────────────────────────────────────
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
        setScreenError('Please share your entire screen — not a window or tab. Select a monitor from the list.');
        return;
      }

      videoTrack.addEventListener('ended', () => {
        if (!endInterviewCalledRef.current) endInterviewRef.current?.();
      });

      screenStreamRef.current = stream;
      setScreenShared(true);
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        setScreenError('Screen sharing is required. Please allow it when prompted.');
      }
    }
  };

  // ── Upload chunk ──────────────────────────────────────────────────────────
  const uploadChunk = (idx: number, chunk: Blob): Promise<void> => {
    const fd = new FormData();
    fd.append('candidateId', candidateId);
    fd.append('chunkIndex', String(idx));
    fd.append('round', '2');
    fd.append('mimeType', recordingMimeRef.current);
    fd.append('chunk', chunk, `chunk_${idx}.webm`);
    return fetch('/api/save-recording-chunk', { method: 'POST', body: fd })
      .then(() => {})
      .catch(() => {});
  };

  // ── End interview ─────────────────────────────────────────────────────────
  const endInterview = useCallback(async () => {
    if (endInterviewCalledRef.current) return;
    endInterviewCalledRef.current = true;

    setIsSubmitting(true);
    setStage('analyzing');

    if (timerRef.current) clearInterval(timerRef.current);

    // Disconnect LiveKit (terminates agent + avatar session)
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (roomNameRef.current) {
      fetch('/api/livekit-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomNameRef.current }),
      }).catch(() => {});
      roomNameRef.current = '';
    }

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
    screenStreamRef.current = null;
    camStreamRef.current = null;

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
            candidateId: parseInt(candidateId),
            round: 2,
            chunkCount: totalChunks,
            mimeType: recordingMimeRef.current,
          }),
        });
        setUploadProgress(80);
      } catch {
        // Non-fatal — chunks are safely stored
      }
    }

    // Submit transcript + trigger scoring
    let isIncomplete = false;
    try {
      const res = await fetch('/api/end-interview-round2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          transcript: transcriptRef.current || '[Interview conducted via avatar — see recording]',
        }),
      });
      const data = await res.json();
      if (data.incomplete) isIncomplete = true;
    } catch (err) {
      console.error('[AvatarInterviewRound2] end-interview-round2 failed:', err);
    }

    if (chunkDBRef.current) {
      idbClearChunks(chunkDBRef.current).catch(() => {});
      chunkDBRef.current = null;
    }

    setUploadProgress(null);
    setStage(isIncomplete ? 'incomplete' : 'ended');
    setIsSubmitting(false);
  }, [candidateId]);

  // Stable ref to endInterview so screen-share track.ended listener can call it
  const endInterviewRef = useRef(endInterview);
  useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

  // ── Build Nova system prompt ──────────────────────────────────────────────
  const buildSystemPrompt = useCallback((): string => {
    const firstName = candidateName.split(' ')[0];

    const probeSection = dossier?.length
      ? dossier.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : 'Probe the candidate deeply on their technical background and experience relevant to the role.';

    const rubricSection = r2Rubric
      ? `\n=== TECHNICAL ASSESSMENT RUBRIC ===\n${r2Rubric}\n\nStructure your questions around this rubric. Ensure you cover every dimension before closing.`
      : '';

    const scoreContext = round1Score != null
      ? `Round 1 (Personality) Score: ${round1Score}/100`
      : 'Round 1 score not available';

    return `=== YOUR IDENTITY ===
NAME: Nova
ROLE: Round 2 Technical Interviewer, Printerpix Hiring Committee.
VIBE: You are warm but incisive. You have reviewed Serena's personality interview with this candidate and you know what they said. Now you go deeper — you probe for real technical depth, not just confidence. You do not accept vague answers.

=== THE CANDIDATE ===
NAME: ${candidateName}
JOB: ${jobTitle}
${jobDescription ? `DESCRIPTION: ${jobDescription.substring(0, 600)}` : ''}

=== CANDIDATE RESUME ===
${resumeText?.substring(0, 1000) || 'Not provided'}

=== PERFORMANCE SO FAR ===
${scoreContext}

=== DOSSIER PROBE AREAS (from Round 1 analysis — address these first) ===
${probeSection}
${rubricSection}

=== INTERVIEW STRUCTURE (5 SECTIONS, ~45 MINUTES TOTAL) ===
Work through these sections in order after covering the dossier probes above.

**Section 1 — Domain Warmup (5 min)**
Surface fluency via the dossier probe questions. Establish baseline and get them talking.

**Section 2 — Technical Deep Dive (15 min)**
Architecture, implementation decisions, and tradeoffs. Push on specifics:
- "Walk me through exactly how you built that — what were the moving parts?"
- "Why that architecture over X? What did you give up?"
- "What broke first when you hit scale?"

**Section 3 — Problem Solving Scenario (10 min)**
Present a live diagnostic scenario relevant to the role. Present a messy technical situation and ask them to reason through it out loud. Interrupt with follow-up constraints mid-answer.

**Section 4 — Learning Velocity Test (8 min)**
Give them an unfamiliar concept or pattern and probe their reasoning:
- Introduce a concept briefly (e.g., "event sourcing" or a relevant architecture pattern)
- Ask: "What problem do you think this solves?"
- Then: "What tradeoffs would you expect?"
Goal: assess how quickly they can reason about the unknown, not whether they already knew it.

**Section 5 — Execution Reality Check (7 min)**
Ask: "What's the most technically complex thing you've shipped? Walk me through it."
Then: "What broke? What would you do differently?"

=== CONFIDENCE CALIBRATION PROBES (use at least twice during the interview) ===
After any significant answer: "How confident are you in that answer from one to ten — and why?"
Use this probe at least twice. Low confidence is fine; it shows self-awareness. High confidence with shallow reasoning is a red flag.

=== ADDITIONAL PROBE RULES ===
- Textbook-clean answer with no friction: "What would break this approach at ten times the scale?"
- Shallow or high-level answer: "Can you go one level deeper on that component?"

=== INTERVIEW RULES ===
1. Verify, never accept surface answers. "I used React" → What state management? What performance problems did you hit?
2. Push on vague answers: "Walk me through exactly how you did that — what was your specific approach?"
3. Test tradeoffs: "Why that approach over X? What did you sacrifice?"
4. Do NOT accept buzzwords — make them define and demonstrate every technical term.
5. NEVER pretend to be the candidate. You are Nova. You ASK questions only.
6. Keep responses under 60 words unless a technical explanation genuinely requires more.
7. After 2 follow-up probes on any topic, move to the next area.

=== INTERVIEW DURATION ===
This interview lasts 40 minutes. You will be given time updates automatically.
At the 38-minute mark you will receive a wrap-up cue — deliver the closing script below at that point.

=== CLOSING SCRIPT — say this word for word when it is time to close ===
"${firstName}, you have given me a thorough picture of your technical background today. Thank you for your time — we will review everything with the team and be in touch with next steps very soon. Best of luck. [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

=== REMEMBER ===
You are Nova. You ASK questions. You do NOT describe your own experience or background.
${candidateName} is the candidate. They answer. You probe.`;
  }, [candidateName, jobTitle, jobDescription, resumeText, dossier, r2Rubric, round1Score]);

  // ── Start interview ───────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    stopMediaCheck();
    setStage('starting');

    try {
      // 1. Camera + mic (reuse check stream if available, otherwise re-acquire)
      let camStream = checkStreamRef.current;
      if (!camStream) {
        camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      checkStreamRef.current = null; // hand ownership to camStreamRef
      camStreamRef.current = camStream;
      setCamReady(true);

      // 2. Build combined recording stream (screen video + mic audio + agent audio)
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      recordingDestRef.current = dest;
      const micSource = audioCtx.createMediaStreamSource(camStream);
      micSource.connect(dest);

      const screenAudioTracks = screenStreamRef.current?.getAudioTracks() ?? [];
      if (screenAudioTracks.length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks));
        sysSource.connect(dest);
      }

      const screenVideoTrack = screenStreamRef.current!.getVideoTracks()[0];
      const recordingStream = new MediaStream([screenVideoTrack, ...dest.stream.getAudioTracks()]);

      // 3. Init recording
      const db = await openChunkDB();
      await idbClearChunks(db);
      chunkDBRef.current = db;
      chunkIndexRef.current = 0;
      pendingUploadsRef.current = [];

      const mimeType = (['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t))) ?? 'video/webm';
      recordingMimeRef.current = mimeType;

      // 4. Get LiveKit token BEFORE starting recording — fail fast if not configured
      const roomName = `round2-${candidateId}-${Date.now()}`;
      roomNameRef.current = roomName;
      const systemPrompt = buildSystemPrompt();

      const tokenRes = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, candidateName, roomName, systemPrompt, round: 2 }),
      });
      const tokenData = await tokenRes.json();
      if (tokenRes.status === 429) throw new Error(tokenData.error);
      if (!tokenData.token) throw new Error(tokenData.error || 'Failed to get LiveKit token');
      const { token, url } = tokenData;

      // 5. Start recording only after token is confirmed
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

      // 6. Connect to LiveKit room
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
        if (track.kind === Track.Kind.Video) {
          if (agentVideoRef.current) {
            track.attach(agentVideoRef.current);
            if (agentVideoBgRef.current) track.attach(agentVideoBgRef.current);
            setAgentConnected(true);
            setStatusText('');
          } else {
            pendingVideoTrackRef.current = track;
          }
        }
        if (track.kind === Track.Kind.Audio) {
          if (agentAudioRef.current) {
            track.attach(agentAudioRef.current);
            agentAudioRef.current.play().catch(() => {});
          } else {
            pendingAudioTrackRef.current = track;
          }
          if (audioCtxRef.current && recordingDestRef.current && track.mediaStreamTrack) {
            const agentStream = new MediaStream([track.mediaStreamTrack]);
            const agentSource = audioCtxRef.current.createMediaStreamSource(agentStream);
            agentSource.connect(recordingDestRef.current);
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaking     = speakers.some(p => !p.isLocal);
        const candidateSpeaking = speakers.some(p => p.isLocal);
        setIsSpeaking(agentSpeaking);
        setIsListening(candidateSpeaking && !agentSpeaking);
      });

      // Collect transcript using the current LiveKit text-stream API (livekit-client ≥2.x)
      // Each call receives one segment (interim or final). lk.transcription_final='true' = end of utterance.
      room.registerTextStreamHandler('lk.transcription', async (reader, participantInfo) => {
        const isAgent = participantInfo.identity !== room.localParticipant.identity;
        const speaker = isAgent ? `Nova (Interviewer)` : `${candidateName} (Candidate)`;
        const isFinal = reader.info.attributes?.['lk.transcription_final'] === 'true';

        const text = (await reader.readAll()).trim();
        if (!text) return;

        if (isAgent) {
          setLastAgentText(text.replace('[END_INTERVIEW]', '').trim());
        }

        if (isFinal) {
          transcriptRef.current += `\n${speaker}:\n${text}\n`;
          if (isAgent) {
            setAgentTurnCount(n => n + 1);
            if (text.includes('[END_INTERVIEW]')) setTimeout(() => endInterview(), 2000);
          }
        }
      });

      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg.type === 'interview_ended') setTimeout(() => endInterview(), 2000);
        } catch { /* ignore */ }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected && !endInterviewCalledRef.current) endInterview();
      });

      await room.connect(url, token, { rtcConfig: { iceTransportPolicy: 'relay' } });
      await room.localParticipant.enableCameraAndMicrophone();

      setStage('active');
      setStatusText('Connecting Nova...');
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    } catch (err) {
      console.error('[AvatarInterviewRound2] Start failed:', err);
      if (recorderRef.current && isRecordingRef.current) {
        recorderRef.current.stop();
        isRecordingRef.current = false;
        recorderRef.current = null;
      }
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      recordingDestRef.current = null;
      setCamReady(false);

      const errMsg = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('ERR_NAME_NOT_RESOLVED') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('network');

      if (isNetworkError) {
        setStage('connection-error');
      } else {
        setStage('setup');
        setScreenError(errMsg.includes('not configured')
          ? 'Interview service is not available. Please contact support.'
          : `Failed to start interview: ${errMsg}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, candidateName, buildSystemPrompt, endInterview, stopMediaCheck]);

  // Hard cutoff at 55 minutes
  useEffect(() => {
    if (elapsedSeconds === 3300 && stage === 'active') endInterview();
  }, [elapsedSeconds, stage, endInterview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaCheck();
      checkStreamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      roomRef.current?.disconnect();
      if (roomNameRef.current) {
        fetch('/api/livekit-end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: roomNameRef.current }),
        }).catch(() => {});
      }
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [stopMediaCheck]);

  // ── Renders ───────────────────────────────────────────────────────────────
  const firstName    = candidateName?.split(' ')[0] || candidateName;
  const micFeedback  = micLevel < 10 ? 'Too quiet' : micLevel <= 50 ? 'Good!' : 'Great!';
  const micFeedbackColor = micLevel < 10 ? 'text-yellow-400' : 'text-emerald-400';
  const isNearEnd    = stage === 'active' && elapsedSeconds >= 2280 - 300;

  return (
    <>
      {/*
        Audio element lives OUTSIDE all stage conditionals so it is never
        unmounted between stage transitions. This prevents the race where
        the LiveKit audio track arrives (and is attached) while the element
        is temporarily absent from the DOM, or where a remount causes the
        attached track to be silently lost.
      */}
      <audio ref={agentAudioRef} autoPlay className="hidden" />

      {/* ── Setup / idle screen — matches VoiceAvatar design ──────────── */}
      {stage === 'setup' && (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <Image
              src="/logo.jpg"
              alt="Printerpix"
              width={56}
              height={56}
              className="rounded-xl mx-auto mb-4"
            />
          </div>

          {/* Welcome heading */}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
            Welcome, <span className="text-cyan-400">{firstName}</span>, to your Round 2 technical interview for the{' '}
            <span className="text-cyan-400">{jobTitle}</span> role at Printerpix.
          </h1>

          {/* Instructions card */}
          <div className="bg-card/80 border border-border rounded-2xl p-6 sm:p-8 mb-8">
            <p className="text-muted-foreground text-sm mb-5">
              This is a 40-minute guided technical interview. We want you to perform at your absolute best, so please keep the following in mind:
            </p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Screen sharing required:</strong> You will be asked to share your full screen before the interview begins. This is required for compliance monitoring — please select a <strong className="text-foreground">monitor</strong>, not a window or tab.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Secure a strong connection:</strong> We record this conversation for our team to review. A stable internet connection ensures your answers are captured in high quality.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Speak clearly and project:</strong> Find a quiet space and speak at a strong, conversational volume so every word is recorded perfectly.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold shrink-0">&#x2022;</span>
                <span><strong className="text-foreground">Be detailed and specific:</strong> Nova will probe your answers. Give concrete examples, name technologies, describe tradeoffs — surface-level answers will be followed up.</span>
              </li>
            </ul>
          </div>

          {/* Camera preview + mic level (shown after media check) */}
          {mediaCheckDone && (
            <div className="mb-6 space-y-4">
              <div className="mx-auto w-64 h-48 rounded-xl overflow-hidden border-2 border-border bg-card flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center text-red-400">
                    <CameraOff className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm font-medium">Camera is required for this interview</p>
                    <p className="text-xs text-muted-foreground mt-1">Please allow camera access and reload</p>
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
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium w-20 text-right ${micFeedbackColor}`}>
                    {micFeedback}
                  </span>
                </div>
              )}
            </div>
          )}

          {(screenError) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400">{screenError}</p>
            </div>
          )}

          {/* Action buttons — cycle through steps */}
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
                disabled={micError || cameraError}
                className={`px-8 py-4 text-white text-lg font-semibold rounded-xl transition-all transform shadow-lg ${
                  micError || cameraError
                    ? 'bg-muted cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 shadow-cyan-500/25'
                }`}
              >
                Start Interview with Nova
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── Starting screen ──────────────────────────────────────────────── */}
      {stage === 'starting' && (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-foreground text-lg">Setting up your interview...</p>
          <p className="text-muted-foreground text-sm mt-2">Connecting to Nova</p>
        </div>
      </div>
      )}

      {/* ── Connection error ─────────────────────────────────────────────── */}
      {stage === 'connection-error' && (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Connection Failed</h2>
          <p className="text-muted-foreground mb-2">
            The avatar interview couldn&apos;t connect. This is usually caused by a network or internet connectivity issue.
          </p>
          <p className="text-muted-foreground/70 text-sm mb-6">
            Please check your internet connection and try again. If the problem persists, contact your recruiter.
          </p>
          <button
            onClick={() => { setStage('setup'); setScreenShared(false); }}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
      )}

      {/* ── Incomplete ───────────────────────────────────────────────────── */}
      {stage === 'incomplete' && (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Interview Incomplete</h2>
          <p className="text-muted-foreground mb-2">
            It looks like the session ended before enough responses were recorded.
          </p>
          <p className="text-muted-foreground/70 text-sm">
            No data has been saved. Please use the same link to retake the interview when you&apos;re ready.
          </p>
        </div>
      </div>
      )}

      {/* ── Analyzing / Ended ────────────────────────────────────────────── */}
      {(stage === 'analyzing' || stage === 'ended') && (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          {stage === 'analyzing' ? (
            <>
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Wrapping Up</h2>
              <p className="text-muted-foreground">Saving your session and submitting responses...</p>
              {uploadProgress !== null && (
                <div className="mt-6">
                  <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
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
                Our team will review your responses and be in touch soon.
              </p>
            </>
          )}
        </div>
      </div>
      )}

      {/* ── Active interview — two-panel layout ──────────────────────────── */}
      {stage === 'active' && (
    <div className="h-screen bg-[#080810] flex overflow-hidden">

      {/* ── LEFT: Avatar video panel ─────────────────────────────────── */}
      <div className="relative flex-1 bg-black overflow-hidden">
        {/* Blurred background */}
        <video ref={agentVideoBgRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-20" />
        {/* Main agent video */}
        <video ref={agentVideoRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-contain" />

        {/* Connecting overlay */}
        {!agentConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-white font-medium">{statusText}</p>
            <p className="text-white/50 text-sm mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* Recording badge + timer */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            RECORDING
          </div>
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/80 text-sm font-mono px-3 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        {/* Bottom: Nova speech text (streaming) + waveform */}
        {agentConnected && (
          <div className="absolute bottom-5 left-5 right-5">
            <div className="bg-black/70 backdrop-blur-md rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
                <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Nova</span>
              </div>
              <p className="text-white text-base leading-relaxed italic min-h-[1.5rem]">
                {lastAgentText ? `"${lastAgentText}"` : 'Preparing first question…'}
              </p>
              {isSpeaking && (
                <div className="flex items-end gap-1 mt-3">
                  {[3,5,8,6,4,7,5,3].map((h, i) => (
                    <div key={i} className="w-1 bg-indigo-400 rounded-full animate-pulse"
                      style={{ height: `${h * 2}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              )}
            </div>
            {(isSpeaking || isListening) && (
              <div className="mt-2 flex justify-center">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isSpeaking ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                  <span className="text-white/80 text-sm">
                    {isSpeaking ? 'Nova is speaking' : 'Listening…'}
                  </span>
                  {isListening && <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Sidebar ────────────────────────────────────────────── */}
      <div className="w-[360px] shrink-0 bg-[#0d0d1a] border-l border-white/10 flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white">Round 2 — Technical Interview</h2>
          <p className="text-xs text-indigo-400/80 mt-0.5">Nova · AI Technical Interviewer</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Candidate camera */}
          <div>
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
              <video ref={camVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!camReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                <span className="text-white/70 text-xs">You</span>
              </div>
            </div>
            <p className="text-[10px] text-white/30 mt-1 text-center">Your Camera</p>
          </div>

          {/* System status grid */}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">System Status</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Screen Share',   value: 'Sharing',                                ok: true },
                { label: 'Recording',      value: 'Live',                                   ok: true },
                { label: 'Connection',     value: agentConnected ? 'Connected' : 'Waiting', ok: agentConnected },
                { label: 'Interview Time', value: formatTime(elapsedSeconds),               ok: true },
              ].map(({ label, value, ok }) => (
                <div key={label} className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">{label}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-white/80 text-xs truncate">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls + warnings */}
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <button disabled title="Screen shared"
              className="w-11 h-11 rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 cursor-default">
              <Monitor className="w-4 h-4" />
            </button>

            <button onClick={endInterview} disabled={isSubmitting}
              className="flex items-center gap-2 px-4 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
              <PhoneOff className="w-4 h-4" />
              End Call
            </button>
          </div>

          {isNearEnd && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <p className="text-amber-400 text-xs font-medium">Interview wrapping up soon</p>
            </div>
          )}

          <div className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 text-white/30 shrink-0 mt-0.5" />
            <p className="text-white/30 text-[10px]">Desktop only — Windows &amp; macOS required for screen share assessment.</p>
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
}
