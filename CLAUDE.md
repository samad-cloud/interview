# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voice-Only AI Recruiter — an end-to-end AI-powered recruiting platform. Candidates apply via email, get auto-screened by AI (Gemini), and complete voice interviews with AI interviewers using Deepgram for speech and Gemini for conversation.

## Commands

### Frontend (Next.js — in `frontend/`)
```bash
cd frontend && npm install       # Install dependencies
cd frontend && npm run dev       # Dev server at http://localhost:3000
cd frontend && npm run build     # Production build
cd frontend && npm run lint      # ESLint
```

### Backend (Python — in `backend/`)
```bash
pip install -r requirements.txt          # Install dependencies (from repo root)
cd backend && python listener.py         # Run main pipeline (loops every 60s)
cd backend && python grader.py           # Run grader only
cd backend && python mailer.py           # Run mailer only
python read/ingest.py                    # Run email ingestion only
cd backend && python utils.py            # Generate Gmail OAuth token
```

### Deployment
- **Frontend**: Vercel, root directory set to `frontend/`
- **Backend**: Railway, start command defined in `railway.json` → `cd backend && python listener.py`

## Architecture

Two independently deployed services sharing a Supabase PostgreSQL database:

### Frontend (Vercel) — Next.js 16 / React 19 / TypeScript / Tailwind CSS 4
- **Pages**: `/dashboard` (HR management), `/interview/[token]` (Round 1 — "Wayne"), `/round2/[token]` (Round 2 — "Atlas"), `/gen-job` (job creation), `/screener` (CV screening)
- **API Routes** (`app/api/`): `chat/` (Gemini proxy), `deepgram/` (STT key), `deepgram-tts/` (TTS), `end-interview/` and `end-interview-round2/` (finalization + scoring)
- **Server Actions** (`actions/`): `sendInvite.ts`, `bulkScreen.ts`, `generateJob.ts`, `generateFinalVerdict.ts`, `generateDossier.ts`
- **Key component**: `components/VoiceAvatar.tsx` — the main interview UI (~820 LOC) handling Deepgram WebSocket STT, Gemini chat, and TTS playback

### Backend (Railway) — Python 3.11+
- **`listener.py`**: Main orchestrator running a continuous 60-second loop that calls the pipeline stages in order
- **`read/ingest.py`**: Fetches unread emails from Gmail "Applications" label, extracts resume attachments (PDF/DOCX), parses with Gemini, stores candidates in Supabase
- **`grader.py`**: Scores ungraded candidates against job descriptions using Gemini JSON mode (score ≥ 70 passes)
- **`mailer.py`**: Sends questionnaire emails (Dubai roles for visa check) or interview invite emails with unique token links
- **`utils.py`**: Shared initialization for Gmail API (OAuth2), Gemini client, and Supabase client

### Pipeline Flow
```
Email arrives → ingest.py parses resume → grader.py scores (Gemini) → mailer.py sends invite
→ Candidate opens /interview/[token] → Voice interview (Deepgram STT + Gemini + Deepgram TTS)
→ /api/end-interview scores & stores transcript → HR reviews on /dashboard
→ Optional Round 2 invite → /round2/[token] → same voice pipeline
```

### Candidate Status Progression
`NEW_APPLICATION` → `GRADED` (or `CV_REJECTED`) → `INVITE_SENT` → `INTERVIEW_STARTED` → `COMPLETED`

### Database (Supabase)
Two tables: `jobs` (id, title, description) and `candidates` (tracking all candidate state — scores, transcripts, tokens, status, metadata JSONB). The `interview_token` UUID field generates secure, unguessable interview links.

## Environment Variables

### Frontend (`frontend/.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEEPGRAM_API_KEY`, `GEMINI_API_KEY`

### Backend (`backend/.env`)
`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, `GOOGLE_CREDENTIALS_JSON` (full credentials.json as string), `GOOGLE_TOKEN_JSON` (full token.json as string)

## Key Patterns

- **Gemini JSON mode**: Used in grader.py and ingest.py with regex fallback parsing when JSON response is malformed
- **Gmail OAuth2**: Production mode reads credentials from env vars (JSON strings); local dev uses `credentials.json`/`token.json` files. Token refresh is handled automatically.
- **Voice interview pipeline**: Deepgram WebSocket for real-time STT → Gemini chat API with system prompts defining interviewer personality → Deepgram Aura TTS for spoken responses. Conversation history maintained in React refs.
- **Interview security**: UUID tokens for links, status-gated retake prevention, `created_at` field prevents emailing legacy candidates
