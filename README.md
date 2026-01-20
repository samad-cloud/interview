# Voice-Only AI Recruiter

A complete AI-powered recruiting pipeline with **voice-only interviews** (no video avatar).

## 🎯 What It Does

```
📧 Applications come in via email
        ↓
   AI reads the resume & scores it (0-100)
        ↓
   Score below 70? → Auto-rejected
        ↓
   Score 70+? → Candidate gets interview link
        ↓
   Voice AI Interview (Deepgram + Gemini)
        ↓
   AI scores the interview
        ↓
   Results appear on Dashboard
```

## 📁 Project Structure

```
voice only/
├── frontend/           # Next.js app (Dashboard + Voice Interview)
│   ├── app/
│   │   ├── dashboard/  # HR Dashboard
│   │   ├── interview/  # Voice interview page
│   │   ├── round2/     # Round 2 technical interview
│   │   ├── screener/   # Bulk resume uploader
│   │   └── api/        # API routes
│   └── components/
│       └── VoiceAvatar.tsx  # The voice interview UI
│
├── backend/            # Python scripts (Railway)
│   ├── listener.py     # Main loop - orchestrates pipeline
│   ├── grader.py       # Scores resumes with AI
│   ├── mailer.py       # Sends interview invites
│   └── utils.py        # Shared utilities
│
└── read/
    └── ingest.py       # Email ingestion + resume parsing
```

## 🚀 Setup

### Frontend (Vercel)

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Add your keys
npm run dev
```

**Required Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DEEPGRAM_API_KEY=
GOOGLE_API_KEY=  # For Gemini
```

### Backend (Railway)

```bash
cd backend
pip install -r ../requirements.txt
python listener.py
```

**Required Environment Variables:**
```
SUPABASE_URL=
SUPABASE_KEY=
GEMINI_API_KEY=
GOOGLE_CREDENTIALS=  # Base64 encoded service account JSON
```

## 🎤 Voice Interview Flow

1. Candidate clicks interview link: `/interview/{token}`
2. Pulsing circle UI with subtitles
3. **Deepgram STT** → Transcribes candidate's speech
4. **Gemini AI** → Generates interviewer questions
5. **Deepgram Aura TTS** → Speaks the AI response
6. Interview ends → AI analyzes transcript → Score saved

## 📊 Dashboard Features

- View all candidates with scores
- Filter by role and status
- Send interview invites
- View transcripts and AI summaries
- Bulk resume screening (War Room)

## 🔑 No External Dependencies

This project does **NOT** require:
- ❌ HeyGen (no video avatar)
- ❌ OpenAI (uses Gemini)
- ❌ ElevenLabs (uses Deepgram Aura)

**Only needs:**
- ✅ Deepgram (STT + TTS)
- ✅ Google Gemini (AI brain)
- ✅ Supabase (database)
- ✅ Gmail API (email ingestion)

## 📝 License

Internal use only.
