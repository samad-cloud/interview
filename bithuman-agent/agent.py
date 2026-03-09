"""bitHuman Essence avatar agent -- cloud-hosted, using Gemini + Deepgram.

Usage:
    python agent.py dev        # local dev with LiveKit playground
    python agent.py start      # production worker
"""

import asyncio
import json
import logging
import os
import time

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomOutputOptions,
    WorkerOptions,
    WorkerType,
    cli,
)
from livekit.plugins import bithuman, deepgram, google, silero

logger = logging.getLogger("bithuman-agent")
logger.setLevel(logging.INFO)

load_dotenv()

DEFAULT_PROMPT = (
    "You are Atlas, a senior interviewer conducting a final-round interview. "
    "Be thorough, precise, and ask probing follow-up questions. "
    "Keep responses concise — under 60 words unless more detail is required."
)


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    await ctx.wait_for_participant()

    avatar_id = os.getenv("BITHUMAN_AGENT_ID")
    if not avatar_id:
        raise ValueError(
            "Set BITHUMAN_AGENT_ID in your .env file. "
            "Create an agent at https://www.bithuman.ai"
        )

    # Read dynamic system prompt and candidate name from room metadata (set by Next.js)
    prompt_source = "default"
    try:
        room_metadata = json.loads(ctx.room.metadata or "{}")
        raw_prompt = room_metadata.get("system_prompt")
        candidate_name = room_metadata.get("candidate_name") or ""
        if raw_prompt:
            system_prompt = raw_prompt
            prompt_source = "room_metadata"
        elif os.getenv("AGENT_PROMPT"):
            system_prompt = os.getenv("AGENT_PROMPT")
            prompt_source = "env_AGENT_PROMPT"
        else:
            system_prompt = DEFAULT_PROMPT
            prompt_source = "default"
    except (json.JSONDecodeError, AttributeError):
        system_prompt = os.getenv("AGENT_PROMPT") or DEFAULT_PROMPT
        candidate_name = ""
        prompt_source = "fallback_default"

    first_name = candidate_name.split()[0] if candidate_name else "there"

    logger.info(f"Cloud Essence mode -- avatar_id: {avatar_id}")
    logger.info(f"[SystemPrompt] Source: {prompt_source} | Candidate: {candidate_name or '(unknown)'} | Length: {len(system_prompt)} chars")
    logger.info(f"[SystemPrompt] First 300 chars: {system_prompt[:300].replace(chr(10), ' ')}")
    logger.info(f"[SystemPrompt] Contains probe areas: {'PROBE AREAS' in system_prompt} | Contains rubric: {'RUBRIC' in system_prompt} | Contains red flags: {'RED FLAGS' in system_prompt}")

    avatar = bithuman.AvatarSession(
        avatar_id=avatar_id,
        api_secret=os.getenv("BITHUMAN_API_SECRET"),
        model="expression",
    )

    session = AgentSession(
        stt=deepgram.STT(model="nova-2", language="en-US"),
        llm=google.LLM(
            model="gemini-2.0-flash",
            api_key=os.getenv("GEMINI_API_KEY"),
        ),
        tts=deepgram.TTS(
            model="aura-2-thalia-en",
            api_key=os.getenv("DEEPGRAM_API_KEY"),
        ),
        vad=silero.VAD.load(),
    )

    await avatar.start(session, room=ctx.room)

    await session.start(
        agent=Agent(instructions=system_prompt),
        room=ctx.room,
        room_output_options=RoomOutputOptions(audio_enabled=False),
    )

    # Trigger opening greeting immediately — don't wait for candidate to speak
    await session.say(
        f"Hello {first_name}, thank you for joining us for the final stage. "
        f"I've reviewed your previous conversations, and today we're going to go much deeper. "
        f"Let's begin — give me a brief overview of your background.",
        allow_interruptions=True,
    )

    # ── Session lifecycle management ─────────────────────────────────────────
    INTERVIEW_MINUTES = 40
    WRAP_UP_MINUTE = 38
    start_time = time.time()
    shutdown_event = asyncio.Event()
    wrap_up_triggered = [False]

    closing_script = (
        f"Hello {first_name}, you've given me a very thorough picture today. "
        f"Thank you for your time and effort across all three rounds — "
        f"we'll review everything with the team and be in touch with next steps very soon. "
        f"Best of luck."
    )

    async def _send_ended_signal() -> None:
        """Notify the frontend that the interview is over via a data message."""
        try:
            payload = json.dumps({"type": "interview_ended"}).encode()
            await ctx.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            logger.warning(f"Could not send interview_ended signal: {e}")

    async def interview_timer() -> None:
        """Background task: deliver wrap-up at 38 min, hard-cut at 41 min."""
        while not shutdown_event.is_set():
            await asyncio.sleep(30)
            elapsed_min = (time.time() - start_time) / 60

            if not wrap_up_triggered[0] and elapsed_min >= WRAP_UP_MINUTE:
                wrap_up_triggered[0] = True
                logger.info(f"[Timer] {WRAP_UP_MINUTE} min reached — delivering closing script")
                await session.say(closing_script, allow_interruptions=False)
                # Wait for TTS to finish, then signal end
                await asyncio.sleep(25)
                await _send_ended_signal()
                shutdown_event.set()
                break

            if elapsed_min >= INTERVIEW_MINUTES + 1:
                # Hard cutoff safety net
                logger.info("[Timer] Hard cutoff reached — forcing shutdown")
                await _send_ended_signal()
                shutdown_event.set()
                break

        logger.info("[Timer] Task exiting")

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant) -> None:  # type: ignore[override]
        # Candidate disconnected (not the avatar agent) — shut down gracefully
        if getattr(participant, "identity", "").startswith("candidate-"):
            logger.info(f"[Session] Candidate disconnected — shutting down")
            shutdown_event.set()

    timer_task = asyncio.create_task(interview_timer())

    # Block until interview ends (time, candidate disconnect, or explicit end)
    await shutdown_event.wait()

    timer_task.cancel()
    try:
        await timer_task
    except asyncio.CancelledError:
        pass

    await session.aclose()
    logger.info("[Session] Agent session closed cleanly")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            job_memory_warn_mb=1500,
            num_idle_processes=3,
        )
    )
