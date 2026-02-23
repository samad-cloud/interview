'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Camera, CameraOff, PhoneOff, Loader2, Volume2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface VoiceAvatarProps {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  round?: 1 | 2;
  dossier?: string[];
}

// Conversation tracking types
interface ConversationEntry {
  role: 'interviewer' | 'candidate';
  speaker: string;
  text: string;
  timestamp: Date;
}

type CallStatus = 'idle' | 'connecting' | 'active' | 'analyzing' | 'ended';

export default function VoiceAvatar({
  candidateId,
  candidateName,
  jobTitle,
  jobDescription,
  resumeText,
  round = 1,
  dossier,
}: VoiceAvatarProps) {
  // Call state
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Media state
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Media check state
  const [mediaCheckDone, setMediaCheckDone] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [micError, setMicError] = useState(false);

  // Deepgram STT state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Subtitle state (what the AI is saying)
  const [subtitle, setSubtitle] = useState('');

  // Refs
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const checkVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const checkAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const finalTranscriptRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Conversation history for transcript
  const conversationHistoryRef = useRef<ConversationEntry[]>([]);

  // Refs to break stale closures in async callbacks
  const isMicOnRef = useRef(isMicOn);
  const isSpeakingRef = useRef(isSpeaking);
  const speakCancelledRef = useRef(false);
  const sendToAIRef = useRef<((text: string) => Promise<void>) | null>(null);
  const startDeepgramListeningRef = useRef<(() => Promise<void>) | null>(null);

  // Session recording refs
  const recAudioCtxRef = useRef<AudioContext | null>(null);
  const recDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recMicSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);

  // In-flight welcome audio promises (started on mount, awaited at interview start)
  const welcomeAudioPromisesRef = useRef<Promise<Blob>[] | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Silence detection for "Done Speaking" nudge
  const [showDoneHint, setShowDoneHint] = useState(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interview timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWrappingUp, setIsWrappingUp] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endInterviewRef = useRef<(() => Promise<void>) | null>(null);
  const timeExpiredRef = useRef(false);

  // Round 1 (Wayne) - Personality/Drive assessment
  const round1Prompt = `=== YOUR IDENTITY ===
  NAME: Wayne
  ROLE: Elite Talent Scout at Printerpix.
  VIBE: You are warm but incredibly sharp. You are NOT checking boxes. You are hunting for "A-Players" (top 1% talent).
  GOAL: Determine if ${candidateName} has "The Hunger" (drive, resilience, ownership) or if they are just looking for a paycheck.
  
  === THE CANDIDATE ===
  NAME: ${candidateName}
  JOB: ${jobDescription}
  
  === CANDIDATE'S RESUME ===
  ${resumeText?.substring(0, 1000) || 'No resume provided.'}
  
  === YOUR PSYCHOLOGICAL RADAR (WHAT YOU ARE LOOKING FOR) ===
  1. **Internal Locus of Control:** Do they own their failures? Or do they blame "the system," "the manager," or "bad luck"? (Reject excuse-makers).
  2. **Permissionless Action:** Do they wait for instructions, or do they find solutions? Ask for examples of them solving problems without being asked.
  3. **High Standards:** Do they obsess over quality? Do they hate mediocrity?
  
  === INTERVIEW RULES (HUMAN MODE) ===
  1. **No Robot Lists:** Do NOT ask "Can you tell me about a time..." like a script.
  2. **The "Bridge":** Always acknowledge their last answer before pivoting.
     - *Bad:* "Okay. Next question."
     - *Good:* "That sounds incredibly stressful. I'm curious—when that plan fell apart, did you try to fix it yourself or did you escalate it?"
  3. **Dig Deep:** If they give a vague answer ("I worked hard"), PUSH BACK gently.
     - Say: "Give me the specific numbers. How much money did that actually save?"
  4. **The "Excellence" Test:** Ask questions that reveal if they are a "dead beat" or a "winner."
  5. **NEVER PRETEND TO BE THE CANDIDATE:** You are Wayne the interviewer. NEVER say "I have experience in..." or describe YOUR work history. You have no background to share. The resume above is THEIR experience, not yours.
  
  === INTERVIEW DURATION ===
  This interview lasts 15 minutes. You will be told how much time has elapsed.
  When time is running low (around 13 minutes), wrap up naturally — thank the candidate warmly, summarize your impression briefly, and end with [END_INTERVIEW].
  If you feel you've gathered enough information before time runs out, you may end early the same way.

  === REMEMBER ===
  You are Wayne. You ASK questions. You do NOT answer questions about yourself.
  The candidate is ${candidateName}. They ANSWER your questions.`;

  // Round 2 (Atlas) - Technical verification
  const dossierQuestions = dossier?.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'No specific questions prepared.';
  
  const round2Prompt = `=== YOUR IDENTITY ===
  NAME: Atlas
  ROLE: Senior Technical Architect at Printerpix.
  VIBE: You are professional, direct, and technical. You respect competence and have zero tolerance for BS or buzzwords.
  GOAL: Verify that ${candidateName} actually has the technical depth they claimed in their first interview.
  
  === THE CANDIDATE ===
  NAME: ${candidateName}
  JOB: ${jobDescription}
  
  === CONTEXT ===
  This candidate passed Round 1 (personality/drive assessment). Now YOU need to verify their technical claims.
  
  === TECHNICAL PROBE QUESTIONS (FROM ROUND 1 ANALYSIS) ===
  These are specific technical claims they made. Dig into each one:
  ${dossierQuestions}
  
  === INTERVIEW RULES (SHOW ME THE CODE MODE) ===
  1. **Verify, Don't Accept:** If they say "I optimized the database," ask HOW. What indexes? What query plans? What was the before/after latency?
  2. **Follow Up Relentlessly:** If they give a surface-level answer, dig deeper. "Walk me through the exact steps."
  3. **Test Understanding:** Ask them to explain tradeoffs. "Why did you choose X over Y?"
  4. **Expose Gaps:** It's OK to find gaps. Say "Interesting. So you're less experienced with X? That's fine, just want to understand your level."
  5. **NEVER PRETEND TO BE THE CANDIDATE:** You are Atlas the interviewer. NEVER describe YOUR work history or experience. Ask THEM questions.
  
  === INTERVIEW DURATION ===
  This interview lasts 40 minutes. You will be told how much time has elapsed.
  When time is running low (around 38 minutes), wrap up naturally — thank the candidate, give a brief summary of technical strengths you observed, and end with [END_INTERVIEW].
  If you feel you've verified enough technical depth before time runs out, you may end early the same way.

  === REMEMBER ===
  You are Atlas. You ASK technical questions. You do NOT answer questions about yourself.
  The candidate is ${candidateName}. They ANSWER your questions.`;

  const systemPrompt = round === 2 ? round2Prompt : round1Prompt;
  const interviewerName = round === 2 ? 'Atlas' : 'Wayne';

  // Add entry to conversation history
  const addToConversation = useCallback((role: 'interviewer' | 'candidate', text: string) => {
    const entry: ConversationEntry = {
      role,
      speaker: role === 'interviewer' ? interviewerName : candidateName,
      text: text.trim(),
      timestamp: new Date(),
    };
    conversationHistoryRef.current.push(entry);
    console.log(`[Transcript] ${entry.speaker}: ${entry.text}`);
  }, [candidateName, interviewerName]);

  // Initialize session recording (video + mixed audio)
  const initSessionRecording = useCallback(() => {
    try {
      // Determine best supported MIME type
      let mimeType = '';
      if (typeof MediaRecorder === 'undefined') {
        console.warn('[Recording] MediaRecorder not supported');
        return;
      }
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else {
        console.warn('[Recording] No supported MIME type found');
        return;
      }

      // Create audio context for mixing mic + TTS audio
      const audioCtx = new AudioContext();
      recAudioCtxRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();
      recDestinationRef.current = destination;

      // Connect candidate mic audio into the mix
      if (userStreamRef.current) {
        const audioTracks = userStreamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          const micOnlyStream = new MediaStream(audioTracks);
          const micSource = audioCtx.createMediaStreamSource(micOnlyStream);
          micSource.connect(destination);
          recMicSourceRef.current = micSource;
        }
      }

      // Build combined stream: video track (if available) + mixed audio
      const combinedTracks: MediaStreamTrack[] = [];

      // Add video track if camera is available
      const videoTrack = userStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && !cameraError) {
        combinedTracks.push(videoTrack);
      }

      // Add mixed audio track
      const mixedAudioTrack = destination.stream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        combinedTracks.push(mixedAudioTrack);
      }

      if (combinedTracks.length === 0) {
        console.warn('[Recording] No tracks available for recording');
        return;
      }

      const combinedStream = new MediaStream(combinedTracks);

      // If audio-only, switch to audio MIME type
      const hasVideo = combinedTracks.some(t => t.kind === 'video');
      if (!hasVideo && mimeType.startsWith('video/')) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      }

      // Create MediaRecorder with conservative bitrates (~50MB for 30 min)
      const recorderOptions: MediaRecorderOptions = { mimeType };
      if (hasVideo) {
        recorderOptions.videoBitsPerSecond = 200_000;
      }
      recorderOptions.audioBitsPerSecond = 128_000;

      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      sessionRecorderRef.current = recorder;
      console.log(`[Recording] Initialized: ${mimeType}, hasVideo=${hasVideo}`);
    } catch (err) {
      console.error('[Recording] Init failed, interview proceeds without recording:', err);
    }
  }, [cameraError]);

  // Split text into sentence chunks for pipelined TTS playback
  const splitIntoTTSChunks = (text: string): string[] => {
    // Split on sentence-ending punctuation (keep the punctuation)
    const raw = text.match(/[^.!?]+[.!?]+[\s]*/g);
    if (!raw) return [text];

    // Combine short sentences so each chunk is substantial enough
    // to sound natural but small enough to generate quickly
    const chunks: string[] = [];
    let current = '';
    for (const sentence of raw) {
      if (current.length + sentence.length < 180) {
        current += sentence;
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  };

  // Play a single audio blob with recording mixer routing
  const playAudioChunk = useCallback(async (blob: Blob): Promise<void> => {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Route TTS audio into recording mixer (mic + TTS → single track)
    try {
      if (recAudioCtxRef.current && recDestinationRef.current) {
        if (recAudioCtxRef.current.state === 'suspended') {
          await recAudioCtxRef.current.resume();
        }
        const ttsSource = recAudioCtxRef.current.createMediaElementSource(audio);
        ttsSource.connect(recDestinationRef.current); // → recording
        ttsSource.connect(recAudioCtxRef.current.destination); // → speakers
      }
    } catch (routeErr) {
      console.warn('[Recording] TTS audio routing failed:', routeErr);
    }

    await new Promise<void>((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        console.error('Audio playback error');
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.play().catch((err) => {
        console.error('Audio play failed:', err);
        resolve();
      });
    });
  }, []);

  // Speak text using Deepgram TTS with sentence-chunked pipeline
  // Splits text into sentences, fetches TTS in parallel, plays sequentially.
  // First sentence plays as soon as it's ready — eliminates the long wait.
  const speakText = useCallback(async (text: string) => {
    try {
      isSpeakingRef.current = true;
      speakCancelledRef.current = false;
      setIsSpeaking(true);
      setSubtitle(text);

      // Stop listening while speaking to prevent echo
      if (deepgramSocketRef.current) {
        stopDeepgramListening();
      }

      const chunks = splitIntoTTSChunks(text);

      // Fire all TTS requests in parallel — short chunks generate fast
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

      // Play each chunk sequentially as it resolves
      for (let i = 0; i < audioPromises.length; i++) {
        if (speakCancelledRef.current) break;

        const blob = await audioPromises[i];
        if (speakCancelledRef.current) break;

        await playAudioChunk(blob);
      }

      // Done speaking — reset state and resume listening
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (isMicOnRef.current) {
        startDeepgramListeningRef.current?.();
      }
    } catch (err) {
      console.error('TTS error:', err);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      // Fallback: use browser TTS
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (isMicOnRef.current) {
          startDeepgramListeningRef.current?.();
        }
      };
      speechSynthesis.speak(utterance);
    }
  }, [playAudioChunk]);

  // Stop Deepgram listening - defined before startDeepgramListening for reference
  const stopDeepgramListening = useCallback(() => {
    // Reset accumulated transcript
    finalTranscriptRef.current = '';

    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Close WebSocket
    if (deepgramSocketRef.current) {
      deepgramSocketRef.current.close();
      deepgramSocketRef.current = null;
    }

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setIsListening(false);
    setTranscript('');
  }, []);

  // Send transcript to AI and speak response
  const sendToAI = useCallback(async (text: string) => {
    if (!text.trim() || callStatus !== 'active') return;

    try {
      console.log('Candidate said:', text);
      addToConversation('candidate', text);
      finalTranscriptRef.current = '';
      setTranscript('');
      // Clear silence nudge
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setShowDoneHint(false);

      // Stop listening while processing
      stopDeepgramListening();

      // If time has expired, deliver a farewell instead of asking another question
      if (timeExpiredRef.current) {
        const closingMessage = round === 2
          ? `That's a great answer, ${candidateName}. We've reached the end of our time together. I really appreciate you walking me through the technical details — it's given me a clear picture of your capabilities and how you think through problems. The team will get back to you regarding the next steps of the process within 2 days. If you have any questions for our hiring team, feel free to drop us an email at printerpix.recruitment@gmail.com. Thanks again, and best of luck!`
          : `I really appreciate that answer, ${candidateName}. We've reached the end of our time together, and I want to thank you for being so open and thoughtful with your responses. I've really enjoyed getting to know you. The team will get back to you regarding the next steps of the process within 2 days. If you have any specific questions for our hiring team, feel free to drop them an email at printerpix.recruitment@gmail.com. Take care, and best of luck!`;

        addToConversation('interviewer', closingMessage);
        await speakText(closingMessage);
        await new Promise(resolve => setTimeout(resolve, 300));
        endInterviewRef.current?.();
        return;
      }

      // Call Gemini to generate interviewer response
      const minutesElapsed = Math.floor(elapsedSeconds / 60);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt: systemPrompt,
          history: conversationHistoryRef.current,
          minutesElapsed,
          isWrappingUp,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const { reply } = await response.json();
      console.log('Gemini response:', reply);

      // Check if AI wants to end the interview
      const wantsToEnd = reply.includes('[END_INTERVIEW]');
      const cleanReply = reply.replace(/\[END_INTERVIEW\]/g, '').trim();

      // Log interviewer's response and speak it
      addToConversation('interviewer', cleanReply);
      await speakText(cleanReply);

      // After TTS finishes, auto-end if AI signaled
      if (wantsToEnd) {
        endInterviewRef.current?.();
      }
    } catch (err) {
      console.error('Failed to get AI response:', err);
      setError('Failed to get response');
    }
  }, [callStatus, addToConversation, systemPrompt, speakText, stopDeepgramListening, elapsedSeconds, isWrappingUp, candidateName, round]);

  // Start Deepgram listening
  const startDeepgramListening = useCallback(async () => {
    if (isSpeakingRef.current) return; // Don't start if still speaking
    
    try {
      // Get Deepgram API key from our backend
      const response = await fetch('/api/deepgram');
      if (!response.ok) throw new Error('Failed to get Deepgram key');
      const { key } = await response.json();

      // Get audio stream with echo cancellation
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = audioStream;

      // Connect to Deepgram WebSocket with optimized settings
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
        console.log('Deepgram connected');
        setIsListening(true);

        // Start MediaRecorder
        const mediaRecorder = new MediaRecorder(audioStream, {
          mimeType: 'audio/webm;codecs=opus',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunks every 250ms
        mediaRecorderRef.current = mediaRecorder;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.channel?.alternatives?.[0]?.transcript) {
            const newTranscript = data.channel.alternatives[0].transcript;

            if (newTranscript.trim()) {
              // Clear silence timer — user is speaking
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
              setShowDoneHint(false);

              if (data.is_final) {
                // Append finalized segment to accumulated transcript
                finalTranscriptRef.current = finalTranscriptRef.current
                  ? finalTranscriptRef.current + ' ' + newTranscript
                  : newTranscript;
                setTranscript(finalTranscriptRef.current);

                // Start 5s silence timer — if no new speech, nudge user
                silenceTimerRef.current = setTimeout(() => {
                  if (finalTranscriptRef.current.trim()) {
                    setShowDoneHint(true);
                  }
                }, 5000);
              } else {
                // Show accumulated + current interim
                setTranscript(
                  finalTranscriptRef.current
                    ? finalTranscriptRef.current + ' ' + newTranscript
                    : newTranscript
                );
              }
            }
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err);
        }
      };

      socket.onerror = (error) => {
        console.error('Deepgram error:', error);
        setError('Voice recognition error');
      };

      socket.onclose = () => {
        console.log('Deepgram disconnected');
        setIsListening(false);
      };

      deepgramSocketRef.current = socket;
    } catch (err) {
      console.error('Failed to start Deepgram:', err);
      setError('Could not access microphone');
    }
  }, []);

  // Attach camera stream to video element once it mounts
  useEffect(() => {
    if (isCameraOn && userVideoRef.current && userStreamRef.current) {
      userVideoRef.current.srcObject = userStreamRef.current;
    }
  }, [isCameraOn, callStatus]);

  // Attach camera stream to the check preview video element after render
  useEffect(() => {
    if (mediaCheckDone && !cameraError && checkVideoRef.current && userStreamRef.current) {
      checkVideoRef.current.srcObject = userStreamRef.current;
    }
  }, [mediaCheckDone, cameraError]);

  // Keep refs in sync so async callbacks always read current values
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { sendToAIRef.current = sendToAI; }, [sendToAI]);
  useEffect(() => { startDeepgramListeningRef.current = startDeepgramListening; }, [startDeepgramListening]);

  // Start fetching welcome message TTS immediately on mount (while user is on media-check screen)
  // Stores promises — awaited when user clicks Start Interview
  useEffect(() => {
    const welcomeMessage = round === 2
      ? `Welcome back, ${candidateName}! I'm Atlas, the technical interviewer for the ${jobTitle} role at Printerpix. I've reviewed your conversation with Wayne, and I was impressed. Now I'd like to dig into some of the technical details you mentioned. Same rules apply — take your time, think out loud if it helps, and ask me to repeat anything. Before we begin, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`
      : `Hi ${candidateName}, great to meet you! I'm Wayne, your interviewer for the ${jobTitle} role at Printerpix. It's completely normal to feel a few butterflies — this is a new experience for most people. Today we'll focus on concrete examples from your experience, because that's the best way to understand how you work. Take your time, think out loud if it helps, and ask me to repeat anything if you're unsure. Before we jump into the questions, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`;

    const chunks = splitIntoTTSChunks(welcomeMessage);
    welcomeAudioPromisesRef.current = chunks.map(chunk =>
      fetch('/api/deepgram-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk }),
      }).then(r => {
        if (!r.ok) throw new Error('TTS prefetch failed');
        return r.blob();
      })
    );
    console.log(`[TTS Prefetch] Fired ${chunks.length} welcome audio requests`);
  }, [candidateName, jobTitle, round]);

  // Interview timer — starts when call becomes active, cleans up on end/unmount
  // Round 1: 15 min interview, wrap at 13, expire at 15, hard cutoff 30
  // Round 2: 40 min interview, wrap at 38, expire at 40, hard cutoff 55
  const wrapUpAt = round === 2 ? 2280 : 780;    // 38 min : 13 min
  const expireAt = round === 2 ? 2400 : 900;    // 40 min : 15 min
  const hardCutoff = round === 2 ? 3300 : 1800; // 55 min : 30 min

  useEffect(() => {
    if (callStatus === 'active') {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          if (next === wrapUpAt) {
            setIsWrappingUp(true);
          }
          if (next === expireAt) {
            timeExpiredRef.current = true;
            setTimeExpired(true);
          }
          if (next >= hardCutoff) {
            endInterviewRef.current?.();
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [callStatus, wrapUpAt, expireAt, hardCutoff]);

  // Initialize user camera
  const initUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      userStreamRef.current = stream;
      setIsCameraOn(true);
    } catch (err) {
      console.error('Failed to access camera:', err);
      setIsCameraOn(false);
      // Camera is optional for voice interview
    }
  };

  // Stop media check (analyser loop + audio context)
  const stopMediaCheck = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (checkAudioContextRef.current) {
      checkAudioContextRef.current.close().catch(() => {});
      checkAudioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Pre-interview camera + mic check
  const startMediaCheck = async () => {
    setCameraError(false);
    setMicError(false);
    setError(null);

    let stream: MediaStream | null = null;

    // Try both video + audio first
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      // If both fail, try audio-only
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setCameraError(true);
      } catch {
        // Audio also failed
        setMicError(true);
        setCameraError(true);
        setMediaCheckDone(true);
        return;
      }
    }

    // Camera setup
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      userStreamRef.current = stream;
      setIsCameraOn(true);
    } else {
      setCameraError(true);
    }

    // Mic setup — analyser for level metering
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      try {
        const audioCtx = new AudioContext();
        checkAudioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length;
          // Map 0-128 → 0-100
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('AudioContext error:', err);
        setMicError(true);
      }
    } else {
      setMicError(true);
    }

    setMediaCheckDone(true);
  };

  // Toggle camera
  const toggleCamera = () => {
    if (userStreamRef.current) {
      const videoTrack = userStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // Toggle microphone
  const toggleMic = () => {
    if (isMicOn) {
      stopDeepgramListening();
      setIsMicOn(false);
    } else {
      setIsMicOn(true);
      startDeepgramListening();
    }
  };

  // Stop the bot mid-sentence (also cancels remaining queued chunks)
  const stopSpeaking = () => {
    speakCancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Also stop browser TTS if it's playing
    speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setSubtitle('');
    // Resume listening after stopping
    if (isMicOn) {
      startDeepgramListening();
    }
  };

  // Start the interview
  const startInterview = async () => {
    setCallStatus('connecting');
    setError(null);

    try {
      // Stop the media check analyser loop (camera stream stays alive for reuse)
      stopMediaCheck();

      // If media check wasn't done (shouldn't happen), init camera as fallback
      if (!userStreamRef.current) {
        await initUserCamera();
      }

      // Initialize and start session recording BEFORE welcome message
      initSessionRecording();
      if (sessionRecorderRef.current && sessionRecorderRef.current.state === 'inactive') {
        sessionRecorderRef.current.start(1000); // 1-second chunks
        isRecordingRef.current = true;
        console.log('[Recording] Session recording started');
      }

      // Auto-enable mic so listening starts after welcome message
      setIsMicOn(true);

      setCallStatus('active');

      // Welcome message - varies by round
      const welcomeMessage = round === 2
        ? `Welcome back, ${candidateName}! I'm Atlas, the technical interviewer for the ${jobTitle} role at Printerpix. I've reviewed your conversation with Wayne, and I was impressed. Now I'd like to dig into some of the technical details you mentioned. Same rules apply — take your time, think out loud if it helps, and ask me to repeat anything. Before we begin, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`
        : `Hi ${candidateName}, great to meet you! I'm Wayne, your interviewer for the ${jobTitle} role at Printerpix. It's completely normal to feel a few butterflies — this is a new experience for most people. Today we'll focus on concrete examples from your experience, because that's the best way to understand how you work. Take your time, think out loud if it helps, and ask me to repeat anything if you're unsure. Before we jump into the questions, could you just confirm that you can hear me clearly? Once you reply, please click the green 'Done speaking' button to let me know!`;

      addToConversation('interviewer', welcomeMessage);

      // Play welcome audio from the requests fired on mount
      // If already resolved → instant playback. If still in-flight → awaits seamlessly.
      isSpeakingRef.current = true;
      speakCancelledRef.current = false;
      setIsSpeaking(true);
      setSubtitle(welcomeMessage);

      if (deepgramSocketRef.current) {
        stopDeepgramListening();
      }

      const promises = welcomeAudioPromisesRef.current!;
      for (const promise of promises) {
        if (speakCancelledRef.current) break;
        const blob = await promise;
        if (speakCancelledRef.current) break;
        await playAudioChunk(blob);
      }

      isSpeakingRef.current = false;
      setIsSpeaking(false);
      if (isMicOnRef.current) {
        startDeepgramListeningRef.current?.();
      }

    } catch (err) {
      console.error('Failed to start interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setCallStatus('idle');
    }
  };

  // Format conversation history as readable transcript
  const formatTranscript = useCallback((): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let transcript = `INTERVIEW TRANSCRIPT
================================================================================
Candidate: ${candidateName}
Position: ${jobDescription}
Date: ${dateStr}
Time: ${timeStr}
Round: ${round}
================================================================================

`;

    for (const entry of conversationHistoryRef.current) {
      const role = entry.role === 'interviewer' ? `${interviewerName} (Interviewer)` : `${candidateName} (Candidate)`;
      transcript += `${role}:\n${entry.text}\n\n`;
    }

    return transcript;
  }, [candidateName, jobDescription, interviewerName, round]);

  // End interview and save transcript
  const endInterview = async () => {
    setCallStatus('analyzing');

    // Stop Deepgram and any playing audio
    stopDeepgramListening();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // --- Phase 1: Stop recording and finalize blob ---
    let recordingBlob: Blob | null = null;
    if (sessionRecorderRef.current && isRecordingRef.current) {
      try {
        recordingBlob = await new Promise<Blob>((resolve) => {
          const recorder = sessionRecorderRef.current!;
          recorder.onstop = () => {
            const mimeType = recorder.mimeType || 'video/webm';
            const blob = new Blob(recordingChunksRef.current, { type: mimeType });
            console.log(`[Recording] Finalized: ${(blob.size / 1024 / 1024).toFixed(1)}MB`);
            resolve(blob);
          };
          recorder.stop();
        });
      } catch (err) {
        console.error('[Recording] Failed to stop recorder:', err);
      }
      isRecordingRef.current = false;
      sessionRecorderRef.current = null;
      recordingChunksRef.current = [];
    }

    // Close recording audio context
    if (recAudioCtxRef.current) {
      recAudioCtxRef.current.close().catch(() => {});
      recAudioCtxRef.current = null;
      recDestinationRef.current = null;
      recMicSourceRef.current = null;
    }

    // Now stop camera/mic tracks
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // --- Phase 2: Save transcript (primary, must succeed) ---
    try {
      const transcriptText = formatTranscript();
      console.log('Final transcript:', transcriptText);

      const endpoint = round === 2 ? '/api/end-interview-round2' : '/api/end-interview';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: parseInt(candidateId),
          transcript: transcriptText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save interview');
      }

      const result = await response.json();
      console.log('Interview saved:', result);
    } catch (err) {
      console.error('Failed to end interview:', err);
      setError('Failed to save interview data');
    }

    // --- Phase 3: Upload recording (secondary, non-fatal) ---
    if (recordingBlob && recordingBlob.size > 0) {
      try {
        setUploadProgress(0);
        const timestamp = Date.now();
        const folder = round === 2 ? 'round2' : 'round1';
        const ext = recordingBlob.type.startsWith('video/') ? 'webm' : 'webm';
        const filePath = `${folder}/${candidateId}-${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('interview-recordings')
          .upload(filePath, recordingBlob, {
            contentType: recordingBlob.type,
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        setUploadProgress(100);
        console.log('[Recording] Uploaded to:', filePath);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('interview-recordings')
          .getPublicUrl(filePath);

        const publicUrl = urlData?.publicUrl;

        if (publicUrl) {
          const videoColumn = round === 2 ? 'round_2_video_url' : 'video_url';
          const { error: dbError } = await supabase
            .from('candidates')
            .update({ [videoColumn]: publicUrl })
            .eq('id', parseInt(candidateId));

          if (dbError) {
            console.error('[Recording] Failed to save video URL to DB:', dbError);
          } else {
            console.log(`[Recording] Saved ${videoColumn}:`, publicUrl);
          }
        }
      } catch (err) {
        console.error('[Recording] Upload failed (transcript already saved):', err);
      } finally {
        setUploadProgress(null);
      }
    }

    setCallStatus('ended');
  };

  // Keep endInterview ref in sync (defined after the function so it's not used before declaration)
  useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopDeepgramListening();
      stopMediaCheck();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Cleanup session recording
      if (sessionRecorderRef.current && sessionRecorderRef.current.state !== 'inactive') {
        sessionRecorderRef.current.stop();
      }
      sessionRecorderRef.current = null;
      recordingChunksRef.current = [];
      isRecordingRef.current = false;
      if (recAudioCtxRef.current) {
        recAudioCtxRef.current.close().catch(() => {});
        recAudioCtxRef.current = null;
      }
      recDestinationRef.current = null;
      recMicSourceRef.current = null;
    };
  }, [stopDeepgramListening, stopMediaCheck]);

  // ============ RENDER ============

  // Mic level feedback text
  const micFeedback = micLevel < 10 ? 'Too quiet' : micLevel <= 50 ? 'Good!' : 'Great!';
  const micFeedbackColor = micLevel < 10 ? 'text-yellow-400' : 'text-emerald-400';

  // Idle State - Start Screen
  if (callStatus === 'idle') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-lg w-full">
          {!mediaCheckDone && (
            <div className="w-32 h-32 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-8 flex items-center justify-center">
              <Volume2 className="w-16 h-16 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-4">
            Voice Interview
          </h1>
          <p className="text-xl text-white mb-2">
            Welcome, <span className="text-cyan-400 font-semibold">{candidateName}</span>! 👋
          </p>
          <p className="text-slate-400 mb-6">
            You&apos;re interviewing for <span className="text-white font-medium">{jobTitle}</span> at Printerpix.
          </p>

          {/* Camera preview + mic level (shown after media check) */}
          {mediaCheckDone && (
            <div className="mb-6 space-y-4">
              {/* Camera preview */}
              <div className="mx-auto w-64 h-48 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center text-slate-500">
                    <CameraOff className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No camera detected</p>
                  </div>
                ) : (
                  <video
                    ref={checkVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Mic level bar */}
              {micError ? (
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Microphone required — please allow access and try again</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 max-w-xs mx-auto">
                  <Mic className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
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

          {!mediaCheckDone && (
            <p className="text-slate-500 text-sm mb-6">
              This will be a {round === 2 ? '40' : '15'}-minute conversation with our AI interviewer.<br />
              Just relax and be yourself.
            </p>
          )}

          <div className="bg-slate-900/50 rounded-xl p-4 mb-8 text-left inline-block">
            <p className="text-slate-400 text-sm font-medium mb-2">Tips:</p>
            <ul className="text-slate-500 text-sm space-y-1">
              <li>• Find a quiet spot</li>
              <li>• Speak clearly</li>
              <li>• There are no wrong answers!</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="text-cyan-400 text-sm font-medium">
                Important: After finishing each answer, click the <span className="bg-slate-800 px-2 py-0.5 rounded text-white font-semibold">Done Speaking</span> button so the interviewer knows you&apos;re ready for the next question.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            {!mediaCheckDone ? (
              <button
                onClick={startMediaCheck}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
              >
                Check Camera &amp; Mic
              </button>
            ) : (
              <button
                onClick={startInterview}
                disabled={micError}
                className={`px-8 py-4 text-white text-lg font-semibold rounded-xl transition-all transform shadow-lg ${
                  micError
                    ? 'bg-slate-700 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 hover:scale-105 shadow-cyan-500/25'
                }`}
                title={micError ? 'Microphone is required to start the interview' : ''}
              >
                Start Interview
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Connecting State
  if (callStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-6" />
          <p className="text-white text-xl">Connecting...</p>
          <p className="text-slate-500 text-sm mt-2">Preparing your interview</p>
        </div>
      </div>
    );
  }

  // Analyzing State
  if (callStatus === 'analyzing') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">
            Submitting Your Interview
          </h2>
          <p className="text-slate-400">
            We&apos;re wrapping things up and submitting your responses. This should only take a moment...
          </p>
          {uploadProgress !== null && (
            <div className="mt-6">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden max-w-xs mx-auto">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-slate-500 text-sm mt-2">Uploading recording...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ended State
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl p-10 max-w-md mx-auto text-center border border-slate-800">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Interview Complete!
          </h1>
          <p className="text-slate-400 mb-2">
            Thank you for your time, {candidateName}.
          </p>
          <p className="text-slate-500 text-sm">
            Your responses have been recorded and sent to our team. We&apos;ll be in touch soon!
          </p>
          <div className="mt-6 pt-4 border-t border-slate-800">
            <p className="text-slate-500 text-xs">
              Experienced a technical issue? Contact us at{' '}
              <a href="mailto:printerpix.recruitment@gmail.com" className="text-cyan-400 hover:text-cyan-300 underline">
                printerpix.recruitment@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ ACTIVE INTERVIEW STATE ============
  const timerMinutes = Math.floor(elapsedSeconds / 60);
  const timerSecs = elapsedSeconds % 60;
  const timerDisplay = `${timerMinutes.toString().padStart(2, '0')}:${timerSecs.toString().padStart(2, '0')}`;
  const timerUrgent = elapsedSeconds >= wrapUpAt;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Timer - fixed top right */}
      <div className="fixed top-4 right-4 z-20">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border ${
          timeExpired
            ? 'bg-red-500/30 border-red-500/50 text-red-300'
            : timerUrgent
              ? 'bg-red-500/20 border-red-500/40 text-red-400'
              : 'bg-slate-900/80 border-slate-700 text-slate-300'
        }`}>
          <Clock className="w-4 h-4" />
          <span className={`font-mono text-lg font-semibold ${timerUrgent ? 'animate-pulse' : ''}`}>
            {timerDisplay}
          </span>
          {timeExpired && (
            <span className="text-xs font-medium ml-1">Finish your answer</span>
          )}
        </div>
      </div>

      {/* Main Interview Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="relative w-full max-w-2xl">
          {/* Pulsing Circle Avatar */}
          <div className="flex flex-col items-center justify-center">
            <div className={`relative w-48 h-48 mb-8 ${isSpeaking ? 'animate-pulse' : ''}`}>
              {/* Outer glow rings when speaking */}
              {isSpeaking && (
                <>
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-2 bg-cyan-500/30 rounded-full animate-ping" style={{ animationDuration: '1.2s' }} />
                </>
              )}
              
              {/* Main circle */}
              <div className={`absolute inset-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSpeaking 
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/50' 
                  : 'bg-gradient-to-br from-slate-700 to-slate-800'
              }`}>
                <Volume2 className={`w-16 h-16 transition-colors ${isSpeaking ? 'text-white' : 'text-slate-500'}`} />
              </div>
            </div>

            {/* Interviewer Name */}
            <h2 className="text-2xl font-bold text-white mb-2">{interviewerName}</h2>
            <p className="text-slate-500 text-sm mb-8">
              {round === 2 ? 'Technical Interviewer' : 'Talent Scout'}
            </p>
          </div>

        </div>
      </div>

      {/* User Camera (fixed, bottom right above subtitle + control bars) */}
      {isCameraOn && (
        <div className="fixed bottom-[16rem] right-6 w-36 h-28 rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl z-10">
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Subtitle Area */}
      <div className="min-h-24 max-h-48 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 flex items-end justify-center px-8 py-4 overflow-y-auto">
        <div className="max-w-3xl w-full text-center">
          {isSpeaking && subtitle && (
            <p className="text-white text-base font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
          {!isSpeaking && transcript && (
            <p className="text-cyan-400 text-base italic leading-relaxed">
              &ldquo;{transcript}&rdquo;
            </p>
          )}
          {!isSpeaking && !transcript && isListening && (
            <p className="text-slate-500 text-lg">
              Listening...
            </p>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="h-24 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-6">
        {/* Done Speaking Button */}
        {!isSpeaking && (
          <div className="relative">
            {/* Silence nudge — appears after 5s of no voice */}
            {showDoneHint && transcript.trim() && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap animate-bounce">
                <div className="bg-cyan-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/30">
                  Done speaking? Click here!
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-cyan-500" />
                </div>
              </div>
            )}
            <button
              onClick={() => sendToAI(transcript)}
              disabled={!transcript.trim()}
              className={`px-6 h-14 rounded-full text-white font-semibold flex items-center justify-center gap-2 transition-all ${
                transcript.trim()
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-700 opacity-50 cursor-not-allowed'
              }`}
              title="Send your response"
            >
              Done Speaking
            </button>
          </div>
        )}

        {/* End Call */}
        <button
          onClick={endInterview}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all"
          title="End Interview"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
