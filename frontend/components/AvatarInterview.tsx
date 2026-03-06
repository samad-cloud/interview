'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  DataPacket_Kind,
} from 'livekit-client';
import { Mic, Loader2, Monitor, Clock, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { Round3Dossier } from '@/app/actions/generateRound3Dossier';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
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
  r3Rubric: string;
  round1Score: number | null;
  round2Score: number | null;
  round2Verdict: string | null;
}

type Stage = 'screen-setup' | 'ready' | 'starting' | 'active' | 'analyzing' | 'ended';

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
  r3Rubric,
  round1Score,
  round2Score,
  round2Verdict,
}: AvatarInterviewProps) {
  const [stage, setStage]               = useState<Stage>('screen-setup');
  const [screenError, setScreenError]   = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [statusText, setStatusText]     = useState('Connecting avatar...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [camReady, setCamReady]         = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);

  // Streams & recording
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const camStreamRef      = useRef<MediaStream | null>(null);
  const recorderRef       = useRef<MediaRecorder | null>(null);
  const chunkDBRef        = useRef<IDBDatabase | null>(null);
  const chunkIndexRef     = useRef(0);
  const pendingUploadsRef = useRef<Promise<void>[]>([]);
  const isRecordingRef    = useRef(false);
  const recordingMimeRef  = useRef('video/webm');

  // LiveKit
  const roomRef              = useRef<Room | null>(null);
  const agentVideoRef        = useRef<HTMLVideoElement>(null);
  const agentVideoBgRef      = useRef<HTMLVideoElement>(null);
  const agentAudioRef        = useRef<HTMLAudioElement>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const recordingDestRef  = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Transcript
  const transcriptRef     = useRef<string>('');

  // Timers & cleanup
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const camVideoRef       = useRef<HTMLVideoElement>(null);
  const endInterviewCalledRef = useRef(false);
  const roomNameRef       = useRef<string>('');

  // Set srcObject once PiP video element mounts (stage switches to active after stream is ready)
  useEffect(() => {
    if (stage === 'active' && camVideoRef.current && camStreamRef.current) {
      camVideoRef.current.srcObject = camStreamRef.current;
    }
  }, [stage]);

  // ── Build system prompt ───────────────────────────────────────────────────
  const buildSystemPrompt = useCallback((): string => {
    const firstName = candidateName.split(' ')[0];

    const probeSection = dossier?.probeAreas.map((a, i) =>
      `${i + 1}. [${a.priority.toUpperCase()}] ${a.topic}\n   Context: ${a.context}\n   Why probe: ${a.whyProbe}\n   Suggested angles: ${a.suggestedAngles.join(' | ')}`
    ).join('\n\n') ?? 'Assess the candidate thoroughly based on their stated experience and the job requirements.';

    const redFlagsSection = dossier?.redFlags.length
      ? `\n=== RED FLAGS — YOU MUST ADDRESS THESE ===\n${dossier.redFlags.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
      : '';

    const rubricSection = r3Rubric
      ? `\n=== TECHNICAL ASSESSMENT RUBRIC ===\n${r3Rubric}\n\nUse this rubric to structure your technical questions. Before closing, ensure you have gathered at least one substantive answer per rubric dimension. Do not end the interview without covering every dimension.`
      : '';

    const scoreContext = [
      round1Score != null ? `Round 1 Score: ${round1Score}/100` : null,
      round2Score != null ? `Round 2 Score: ${round2Score}/100` : null,
      round2Verdict ? `Round 2 Verdict: ${round2Verdict}` : null,
    ].filter(Boolean).join(' | ') || 'Prior scores not available';

    return `=== YOUR IDENTITY ===
NAME: Atlas
ROLE: Final Vetting Interviewer, Printerpix Hiring Committee.
VIBE: You are the last line of defence before a hire decision. You have read every word this candidate has said across two interviews. You are warm but relentless — you do not let vague answers pass, you do not move on without real evidence, and you never accept buzzwords.

=== THE CANDIDATE ===
NAME: ${candidateName}
JOB: ${jobTitle}
${jobDescription ? `DESCRIPTION: ${jobDescription.substring(0, 600)}` : ''}

=== CANDIDATE RESUME ===
${resumeText?.substring(0, 1000) || 'Not provided'}

=== PERFORMANCE TO DATE ===
${scoreContext}

=== ROUND 3 MISSION ===
${dossier?.interviewerBrief ?? "Conduct a final deep-dive to verify all claims across both previous rounds and establish true depth of knowledge."}

=== PROBE AREAS — work through these in priority order ===
${probeSection}
${redFlagsSection}
${rubricSection}

=== INTERVIEW RULES ===
1. Verify, never accept. "I optimised the database" → How? What indexes? What was before/after latency? Give me numbers.
2. Push immediately on vague answers: "Walk me through exactly how you did that, step by step."
3. Test real understanding: ask about tradeoffs, what failed, what they would do differently.
4. If an answer contradicts anything from Round 1 or Round 2, surface it directly but professionally.
5. Do NOT accept buzzwords — make them define and demonstrate every technical term they use.
6. NEVER pretend to be the candidate. You are Atlas. You ASK questions only. You have no work history to share.
7. After 2 follow-up probes on any topic, move to the next probe area or rubric dimension.
8. Keep responses under 60 words unless a technical explanation genuinely requires more.

=== BREADTH vs DEPTH ===
You MUST cover all probe areas AND all rubric dimensions before closing.
RULE: Maximum 2 follow-up probes per topic. A 3rd follow-up is only permitted if the candidate gave a directly contradictory answer — and only once per topic.
If time is running short, move to uncovered areas immediately. Breadth beats depth every time.

=== INTERVIEW DURATION ===
This interview lasts 40 minutes. You will be given time updates automatically.
Pace yourself to cover all probe areas and rubric dimensions.
At the 38-minute mark you will receive a wrap-up cue — deliver the closing script below at that point.

=== CLOSING SCRIPT — say this word for word when it is time to close ===
"${firstName}, you've given me a very thorough picture today. Thank you for your time and effort across all three rounds — we'll review everything with the team and be in touch with next steps very soon. Best of luck. [END_INTERVIEW]"
You MUST include [END_INTERVIEW] at the very end. Do NOT add anything after it.

=== REMEMBER ===
You are Atlas. You ASK questions. You do NOT describe your own experience or background.
${candidateName} is the candidate. They answer. You probe.`;
  }, [candidateName, jobTitle, jobDescription, resumeText, dossier, r3Rubric, round1Score, round2Score, round2Verdict]);

  // ── Screen share ─────────────────────────────────────────────────────────────
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
        if (stage === 'active') endInterview();
      });

      screenStreamRef.current = stream;
      setStage('ready');
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        setScreenError('Screen sharing is required. Please allow it when prompted.');
      }
    }
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

  // ── Start interview ──────────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setStage('starting');

    try {
      // 1. Camera + mic
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

      // 4. Get LiveKit token and create room with system prompt as metadata
      const roomName = `round3-${candidateId}-${Date.now()}`;
      roomNameRef.current = roomName;
      const systemPrompt = buildSystemPrompt();

      const tokenRes = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, candidateName, roomName, systemPrompt }),
      });
      const { token, url } = await tokenRes.json();
      if (!token) throw new Error('Failed to get LiveKit token');

      // 5. Connect to LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Subscribe to agent video + audio tracks
      room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
        if (track.kind === Track.Kind.Video) {
          if (agentVideoRef.current) track.attach(agentVideoRef.current);
          if (agentVideoBgRef.current) track.attach(agentVideoBgRef.current);
          setAgentConnected(true);
          setStatusText('');
        }
        if (track.kind === Track.Kind.Audio) {
          // Play agent audio in the browser
          if (agentAudioRef.current) track.attach(agentAudioRef.current);
          // Also pipe agent audio directly into the recording mix
          if (audioCtxRef.current && recordingDestRef.current && track.mediaStreamTrack) {
            const agentStream = new MediaStream([track.mediaStreamTrack]);
            const agentSource = audioCtxRef.current.createMediaStreamSource(agentStream);
            agentSource.connect(recordingDestRef.current);
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      // Detect speaking states from active speakers
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaking = speakers.some(p => !p.isLocal);
        const candidateSpeaking = speakers.some(p => p.isLocal);
        setIsSpeaking(agentSpeaking);
        setIsListening(candidateSpeaking && !agentSpeaking);
      });

      // Collect transcript from LiveKit transcription events + detect [END_INTERVIEW]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.on('transcription_received' as any, (segments: any[], participant: any) => {
        const isAgent = participant && !participant.isLocal;
        const speaker = isAgent ? 'Atlas' : candidateName;
        for (const seg of segments) {
          if (seg.final && seg.text?.trim()) {
            const text = seg.text.trim();
            transcriptRef.current += `\n${speaker}: ${text}`;
            // Auto-end when Atlas delivers closing script
            if (isAgent && text.includes('[END_INTERVIEW]')) {
              setTimeout(() => endInterview(), 2000);
            }
          }
        }
      });

      // Handle agent-initiated end (data message from Python agent)
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg.type === 'interview_ended') {
            setTimeout(() => endInterview(), 2000);
          }
        } catch { /* ignore */ }
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected && stage === 'active') {
          endInterview();
        }
      });

      await room.connect(url, token);

      // Publish candidate's camera + mic to the room
      await room.localParticipant.enableCameraAndMicrophone();

      // 6. Update candidate status
      await supabase
        .from('candidates')
        .update({ round_3_status: 'IN_PROGRESS', current_stage: 'round_3' })
        .eq('id', candidateId);

      setStage('active');
      setStatusText('Connecting avatar...');

      // 7. Start timer
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);

    } catch (err) {
      console.error('[AvatarInterview] Start failed:', err);
      setStage('ready');
      setScreenError('Failed to start interview. Please try again.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, candidateName, buildSystemPrompt]);

  // ── End interview ────────────────────────────────────────────────────────────
  const endInterview = useCallback(async () => {
    if (endInterviewCalledRef.current) return;
    endInterviewCalledRef.current = true;

    setIsSubmitting(true);
    setStage('analyzing');

    if (timerRef.current) clearInterval(timerRef.current);

    // Disconnect LiveKit and delete room (terminates agent + avatar session immediately)
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

    // Stop streams and release screen share (dismisses browser sharing banner)
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    camStreamRef.current = null;

    // Close AudioContext
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    recordingDestRef.current = null;

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
        // Non-fatal
      }
    }

    // Submit transcript + trigger scoring
    try {
      await fetch('/api/end-round3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          transcript: transcriptRef.current || '[Interview conducted via avatar — see recording]',
        }),
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
  }, [candidateId]);

  // Hard cutoff at 55 minutes
  useEffect(() => {
    if (elapsedSeconds === 3300 && stage === 'active') endInterview();
  }, [elapsedSeconds, stage, endInterview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
  }, []);

  // ── Render: Screen Setup / Ready ─────────────────────────────────────────────
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

          {stage === 'screen-setup' && (
            <div className="mb-6">
              <p className="text-sm text-foreground mb-4">
                Before we begin, you need to <strong>share your entire screen</strong>. This allows us to record the session and ensure a fair process.
              </p>
              <ol className="space-y-2 text-sm text-muted-foreground mb-6">
                {['Click "Share Screen" below', 'Select Entire Screen (not a window or tab)', 'Click Share in the browser prompt'].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {screenError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {screenError}
            </div>
          )}

          <div className="space-y-3">
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
          <p className="text-muted-foreground text-sm mt-2">Connecting to avatar</p>
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
                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
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
  const isNearEnd = elapsedSeconds >= wrapUpAt - 300;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Hidden audio element for agent TTS */}
      <audio ref={agentAudioRef} autoPlay />

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

      {/* Main area — full screen video like R1/R2 */}
      <div className="relative flex-1 bg-black overflow-hidden">
        {/* Blurred background fill */}
        <video
          ref={agentVideoBgRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover scale-110 blur-2xl transition-opacity duration-500 ${agentConnected ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Sharp foreground */}
        <video
          ref={agentVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${agentConnected ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Connecting state */}
        {!agentConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            <p className="text-muted-foreground text-sm">Connecting avatar...</p>
          </div>
        )}

        {/* Status indicator overlay — bottom left */}
        {agentConnected && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            {isSpeaking ? (
              <>
                <div className="flex gap-0.5 items-end">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1 bg-cyan-400 rounded-full animate-pulse" style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-xs text-cyan-400">Atlas is speaking</span>
              </>
            ) : isListening ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Listening...</span>
              </>
            ) : (
              <>
                <Mic className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Speak naturally</span>
              </>
            )}
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
    </div>
  );
}
