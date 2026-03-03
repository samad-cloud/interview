#!/usr/bin/env python3
"""
The Remuxer: Fixes WebM recordings so they are fully seekable when downloaded.

MediaRecorder produces WebM files without a Cues index or proper duration header,
which means downloaded files cannot be seeked in standard players. This script
runs FFmpeg with -c copy (no re-encoding) to remux each recording into a proper
WebM container with full duration and seek index metadata.

Runs as Step 4 in the listener.py pipeline, processing any unremuxed recordings.
"""

import os
import subprocess
import tempfile
from pathlib import Path

import httpx
from utils import get_supabase_client, log

BUCKET = "interview-recordings"


def extract_storage_path(public_url: str) -> str | None:
    """
    Extract the Supabase Storage path from a public URL.

    e.g. https://xxx.supabase.co/storage/v1/object/public/interview-recordings/round1/abc-final.webm
    returns: round1/abc-final.webm
    """
    marker = f"/{BUCKET}/"
    idx = public_url.find(marker)
    if idx == -1:
        return None
    return public_url[idx + len(marker):]


def remux_with_ffmpeg(input_path: str, output_path: str) -> bool:
    """
    Run FFmpeg -c copy remux to add duration + Cues index to a WebM file.
    Returns True on success.
    """
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-c", "copy", output_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        log("ERROR", f"FFmpeg failed: {result.stderr.decode()[:500]}")
        return False
    return True


def fix_recording(supabase, candidate_id: int, url: str, column: str) -> bool:
    """
    Download a recording, remux it with FFmpeg, re-upload to the same storage
    path (overwrite), and return True on success.
    """
    storage_path = extract_storage_path(url)
    if not storage_path:
        log("WARN", f"[VideoFixer] Could not extract storage path from URL for candidate {candidate_id}: {url}")
        return False

    log("INFO", f"[VideoFixer] Fixing {column} for candidate {candidate_id} — {storage_path}")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.webm")
        output_path = os.path.join(tmpdir, "output.webm")

        # Download the recording
        try:
            response = httpx.get(url, timeout=120, follow_redirects=True)
            response.raise_for_status()
            Path(input_path).write_bytes(response.content)
        except Exception as e:
            log("ERROR", f"[VideoFixer] Download failed for candidate {candidate_id}: {e}")
            return False

        size_mb = Path(input_path).stat().st_size / 1024 / 1024
        log("INFO", f"[VideoFixer] Downloaded {size_mb:.1f}MB — running FFmpeg remux")

        # Remux with FFmpeg
        if not remux_with_ffmpeg(input_path, output_path):
            return False

        fixed_size_mb = Path(output_path).stat().st_size / 1024 / 1024
        log("INFO", f"[VideoFixer] Remux complete ({fixed_size_mb:.1f}MB) — re-uploading to {storage_path}")

        # Re-upload to the same storage path (overwrite)
        try:
            with open(output_path, "rb") as f:
                fixed_bytes = f.read()

            supabase.storage.from_(BUCKET).remove([storage_path])
            supabase.storage.from_(BUCKET).upload(
                storage_path,
                fixed_bytes,
                file_options={"content-type": "video/webm", "upsert": "true"},
            )
        except Exception as e:
            log("ERROR", f"[VideoFixer] Re-upload failed for candidate {candidate_id}: {e}")
            return False

    log("INFO", f"[VideoFixer] Fixed {column} for candidate {candidate_id}")
    return True


def run_video_fixer() -> int:
    """
    Main fixer function — called from listener.py pipeline.
    Finds all candidates with unremuxed recordings and processes them.
    Returns the number of candidates fixed.
    """
    log("INFO", "[VideoFixer] Starting...")

    supabase = get_supabase_client()

    result = (
        supabase.table("candidates")
        .select("id, video_url, round_2_video_url")
        .or_("video_url.not.is.null,round_2_video_url.not.is.null")
        .neq("video_remuxed", True)
        .execute()
    )

    candidates = result.data or []
    log("INFO", f"[VideoFixer] Found {len(candidates)} candidate(s) with unremuxed recordings")

    if not candidates:
        return 0

    fixed_count = 0

    for candidate in candidates:
        candidate_id = candidate["id"]
        success = True

        if candidate.get("video_url"):
            if not fix_recording(supabase, candidate_id, candidate["video_url"], "video_url"):
                success = False

        if candidate.get("round_2_video_url"):
            if not fix_recording(supabase, candidate_id, candidate["round_2_video_url"], "round_2_video_url"):
                success = False

        if success:
            supabase.table("candidates").update({"video_remuxed": True}).eq("id", candidate_id).execute()
            fixed_count += 1
        else:
            log("WARN", f"[VideoFixer] Skipping video_remuxed flag for candidate {candidate_id} due to errors")

    log("INFO", f"[VideoFixer] Done — {fixed_count} candidate(s) fixed")
    return fixed_count


def main():
    """Entry point when run directly."""
    run_video_fixer()


if __name__ == "__main__":
    main()
