'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Camera, CameraOff, PhoneOff, Loader2, Volume2, Square } from 'lucide-react';

interface VoiceAvatarProps {
  candidateId: string;
  candidateName: string;
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
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Deepgram STT state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Subtitle state (what the AI is saying)
  const [subtitle, setSubtitle] = useState('');

  // Refs
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Conversation history for transcript
  const conversationHistoryRef = useRef<ConversationEntry[]>([]);

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

  // Speak text using Deepgram TTS
  const speakText = useCallback(async (text: string) => {
    try {
      setIsSpeaking(true);
      setSubtitle(text);

      // Stop listening while speaking to prevent echo
      if (deepgramSocketRef.current) {
        stopDeepgramListening();
      }

      // Call our TTS API
      const response = await fetch('/api/deepgram-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      // Create audio from the response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        // Always resume listening after speaking (call is active)
        setIsMicOn(true);
        startDeepgramListening();
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        setIsMicOn(true);
        startDeepgramListening();
      };

      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
      // Fallback: use browser TTS
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setIsSpeaking(false);
        setIsMicOn(true);
        startDeepgramListening();
      };
      speechSynthesis.speak(utterance);
    }
  }, []);

  // Stop Deepgram listening - defined before startDeepgramListening for reference
  const stopDeepgramListening = useCallback(() => {
    // Clear auto-send timeout
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }

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
      setTranscript('');
      
      // Stop listening while processing
      stopDeepgramListening();

      // Call Gemini to generate interviewer response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt: systemPrompt,
          history: conversationHistoryRef.current,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const { reply } = await response.json();
      console.log('Gemini response:', reply);
      
      // Log interviewer's response and speak it
      addToConversation('interviewer', reply);
      await speakText(reply);
    } catch (err) {
      console.error('Failed to get AI response:', err);
      setError('Failed to get response');
    }
  }, [callStatus, addToConversation, systemPrompt, speakText, stopDeepgramListening]);

  // Start Deepgram listening
  const startDeepgramListening = useCallback(async () => {
    if (isSpeaking) return; // Don't start if still speaking
    
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
              setTranscript(newTranscript);

              // If this is a final result, set up auto-send
              if (data.is_final && newTranscript.trim().length > 0) {
                // Clear any existing timeout
                if (autoSendTimeoutRef.current) {
                  clearTimeout(autoSendTimeoutRef.current);
                }

                // Auto-send after 1.5 seconds of silence
                autoSendTimeoutRef.current = setTimeout(() => {
                  sendToAI(newTranscript);
                }, 1500);
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
  }, [sendToAI, isSpeaking]);

  // Initialize user camera
  const initUserCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      userStreamRef.current = stream;
      
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
      
      setIsCameraOn(true);
    } catch (err) {
      console.error('Failed to access camera:', err);
      // Camera is optional for voice interview
    }
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

  // Stop the bot mid-sentence
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Also stop browser TTS if it's playing
    speechSynthesis.cancel();
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
      // Initialize user camera (optional)
      await initUserCamera();

      // Auto-enable mic so listening starts after welcome message
      setIsMicOn(true);

      setCallStatus('active');

      // Welcome message - varies by round
      const welcomeMessage = round === 2
        ? `Welcome back, ${candidateName}. I'm Atlas from the technical team. I've reviewed your conversation with Wayne, and now I'd like to dive deeper into some of the things you mentioned. Ready to get started?`
        : `Hey ${candidateName}! Great to meet you. How are you doing today?`;
      
      addToConversation('interviewer', welcomeMessage);
      await speakText(welcomeMessage);

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

    // Stop all media
    stopDeepgramListening();
    
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const transcriptText = formatTranscript();
      console.log('Final transcript:', transcriptText);

      // Call the appropriate end-interview endpoint
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

    setCallStatus('ended');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDeepgramListening();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [stopDeepgramListening]);

  // ============ RENDER ============

  // Extract job title (first part of job description, before location/details)
  const extractJobTitle = (jd: string) => {
    // Take first line or first few words before common delimiters
    const firstLine = jd.split('\n')[0];
    const beforeLocation = firstLine.split(/(?:London|Dubai|Remote|UK|US|Europe|,)/i)[0];
    return beforeLocation.trim() || firstLine.substring(0, 50);
  };

  const jobTitle = extractJobTitle(jobDescription);

  // Idle State - Start Screen
  if (callStatus === 'idle') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-lg">
          <div className="w-32 h-32 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-8 flex items-center justify-center">
            <Volume2 className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Voice Interview
          </h1>
          <p className="text-xl text-white mb-2">
            Welcome, <span className="text-cyan-400 font-semibold">{candidateName}</span>! 👋
          </p>
          <p className="text-slate-400 mb-6">
            You&apos;re interviewing for <span className="text-white font-medium">{jobTitle}</span> at Printerpix.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            This will be a quick 20-30 minute conversation with our AI interviewer.<br />
            Just relax and be yourself.
          </p>
          
          <div className="bg-slate-900/50 rounded-xl p-4 mb-8 text-left inline-block">
            <p className="text-slate-400 text-sm font-medium mb-2">Tips:</p>
            <ul className="text-slate-500 text-sm space-y-1">
              <li>• Find a quiet spot</li>
              <li>• Speak clearly</li>
              <li>• There are no wrong answers!</li>
            </ul>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div>
            <button
              onClick={startInterview}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
            >
              Start Interview
            </button>
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
            Analyzing Your Interview
          </h2>
          <p className="text-slate-400">
            Our AI is reviewing your responses. This usually takes about 10 seconds...
          </p>
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
        </div>
      </div>
    );
  }

  // ============ ACTIVE INTERVIEW STATE ============
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
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

          {/* User Camera (small, bottom right) */}
          {isCameraOn && (
            <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl">
              <video
                ref={userVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Subtitle Area */}
      <div className="h-32 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 flex items-center justify-center px-8">
        <div className="max-w-3xl w-full text-center">
          {isSpeaking && subtitle && (
            <p className="text-white text-xl font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
          {!isSpeaking && transcript && (
            <p className="text-cyan-400 text-lg italic">
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
        {/* Mic Toggle */}
        <button
          onClick={toggleMic}
          disabled={isSpeaking}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMicOn
              ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={toggleCamera}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isCameraOn
              ? 'bg-slate-700 hover:bg-slate-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
          }`}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
        </button>

        {/* Stop Bot (interrupt) */}
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all animate-pulse"
            title="Stop Bot"
          >
            <Square className="w-6 h-6" />
          </button>
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
