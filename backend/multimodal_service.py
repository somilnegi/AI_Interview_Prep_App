"""
Multimodal Analysis Sidecar — FastAPI service
==============================================

Research novelty contribution: fuses THREE signal sources into a unified
delivery score that the main Node.js backend cannot compute natively.

  1. Acoustic features  (librosa)   — pace, pitch variance, pause patterns
  2. Lexical features   (spaCy)     — filler words, hedging, vocabulary richness
  3. STAR cues          (regex/NLP) — Situation/Task/Action/Result keyword detection

Run alongside the Node server:
  uvicorn multimodal_service:app --port 8001 --reload

Node calls it via:
  POST http://localhost:8001/analyse
  Content-Type: multipart/form-data
  Body: audio=<wav/webm blob>

Install deps:
  pip install fastapi uvicorn python-multipart librosa soundfile numpy spacy
  python -m spacy download en_core_web_sm
"""

from __future__ import annotations

import io
import re
import math
import tempfile
import os
from typing import Any

import numpy as np
import librosa
import soundfile as sf
import spacy
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Multimodal Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Load spaCy model once at startup (not per request)
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    raise RuntimeError(
        "spaCy model not found. Run: python -m spacy download en_core_web_sm"
    )

# ─── Constants ────────────────────────────────────────────────────────────────

# Words per minute benchmarks
WPM_IDEAL_LOW  = 120
WPM_IDEAL_HIGH = 160

# Filler words to detect
FILLERS = {
    "um", "uh", "er", "ah", "like", "you know", "i mean",
    "basically", "literally", "honestly", "actually", "so yeah",
    "kind of", "sort of",
}

# Hedging phrases (signal low confidence)
HEDGES = {
    "i think", "i guess", "i believe", "maybe", "perhaps",
    "not sure", "possibly", "might be", "could be", "i feel like",
    "in my opinion", "i'm not sure but",
}

# STAR method keyword signals
STAR_KEYWORDS = {
    "situation": ["when i", "in my previous", "at my last", "while working", "in a project", "there was a situation"],
    "task":      ["i was responsible", "my role was", "i needed to", "i had to", "the goal was", "tasked with"],
    "action":    ["i decided", "i implemented", "i built", "i created", "i worked on", "i collaborated", "i led", "i resolved"],
    "result":    ["as a result", "this led to", "the outcome was", "we achieved", "i improved", "reduced by", "increased by", "successfully"],
}

# ─── Response model ────────────────────────────────────────────────────────────

class MultimodalResult(BaseModel):
    # Acoustic
    duration_seconds:    float
    words_per_minute:    float
    wpm_category:        str          # "too_slow" | "ideal" | "too_fast"
    pause_count:         int
    long_pause_count:    int          # pauses > 2s (signal hesitation)
    pitch_variance:      float        # high = more expressive, low = monotone
    energy_variance:     float        # voice energy variation

    # Lexical
    filler_count:        int
    filler_rate:         float        # fillers per minute
    filler_words_found:  list[str]
    hedge_count:         int
    hedge_phrases_found: list[str]
    vocabulary_richness: float        # type-token ratio (0–1)
    avg_sentence_length: float

    # STAR detection
    star_score:          float        # 0–10 how well structured the answer is
    star_components:     dict[str, bool]  # which STAR phases were detected

    # Composite delivery score (0–10)
    delivery_score:      float
    delivery_breakdown:  dict[str, float]

# ─── Audio processing ─────────────────────────────────────────────────────────

def extract_acoustic_features(audio_bytes: bytes) -> dict[str, Any]:
    """
    Load audio via soundfile → librosa. Handles wav and webm.
    Returns pace, pause, pitch, and energy features.
    """
    suffix = ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    wav_path = tmp_path.replace(suffix, "_converted.wav")
    y = None
    sr = 16000

    try:
        try:
            import subprocess
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path,
                 "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", wav_path],
                capture_output=True, timeout=30
            )
            if result.returncode == 0:
                y, sr = librosa.load(wav_path, sr=16000, mono=True)
        except Exception:
            pass

        if y is None:
            y, sr = librosa.load(tmp_path, sr=16000, mono=True)

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if os.path.exists(wav_path):
            os.unlink(wav_path)

    duration = librosa.get_duration(y=y, sr=sr)

    # ── Pause detection via RMS energy ──────────────────────────────────────
    # Frames with RMS below threshold are silence/pauses
    frame_length = 2048
    hop_length   = 512
    rms     = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    silence_threshold = np.percentile(rms, 15)  # adaptive threshold

    is_silent   = rms < silence_threshold
    pause_count = 0
    long_pauses = 0
    in_pause    = False
    pause_start = 0
    frame_dur   = hop_length / sr

    for i, silent in enumerate(is_silent):
        if silent and not in_pause:
            in_pause    = True
            pause_start = i
        elif not silent and in_pause:
            pause_len = (i - pause_start) * frame_dur
            if pause_len > 0.5:   # minimum pause threshold
                pause_count += 1
            if pause_len > 2.0:   # long hesitation pause
                long_pauses += 1
            in_pause = False

    # ── Pitch (F0) variance ──────────────────────────────────────────────────
    f0, _, _ = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"))
    voiced_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
    pitch_variance = float(np.std(voiced_f0)) if len(voiced_f0) > 0 else 0.0

    # ── Energy variance ──────────────────────────────────────────────────────
    energy_variance = float(np.std(rms))

    return {
        "duration_seconds": round(duration, 2),
        "pause_count":       pause_count,
        "long_pause_count":  long_pauses,
        "pitch_variance":    round(pitch_variance, 4),
        "energy_variance":   round(energy_variance, 6),
    }

# ─── Text processing ──────────────────────────────────────────────────────────

def extract_lexical_features(transcript: str, duration_seconds: float) -> dict[str, Any]:
    """
    spaCy-based lexical analysis: fillers, hedges, vocabulary richness.
    """
    text  = transcript.strip().lower()
    doc   = nlp(text)
    words = [token.text for token in doc if token.is_alpha]
    word_count = len(words)

    # ── Filler detection ────────────────────────────────────────────────────
    found_fillers = []
    for filler in FILLERS:
        count = len(re.findall(r"\b" + re.escape(filler) + r"\b", text))
        found_fillers.extend([filler] * count)

    filler_count = len(found_fillers)
    minutes      = max(duration_seconds / 60, 0.01)
    filler_rate  = round(filler_count / minutes, 2)

    # ── Hedge detection ──────────────────────────────────────────────────────
    found_hedges = [h for h in HEDGES if h in text]
    hedge_count  = sum(text.count(h) for h in found_hedges)

    # ── Vocabulary richness (type-token ratio) ───────────────────────────────
    unique_words    = set(words)
    vocab_richness  = round(len(unique_words) / max(word_count, 1), 3)

    # ── Words per minute ─────────────────────────────────────────────────────
    wpm = round(word_count / minutes, 1)
    if wpm < WPM_IDEAL_LOW:
        wpm_category = "too_slow"
    elif wpm > WPM_IDEAL_HIGH:
        wpm_category = "too_fast"
    else:
        wpm_category = "ideal"

    # ── Average sentence length ──────────────────────────────────────────────
    sentences = list(doc.sents)
    avg_sent_len = round(
        sum(len([t for t in s if t.is_alpha]) for s in sentences) / max(len(sentences), 1),
        1,
    )

    return {
        "words_per_minute":    wpm,
        "wpm_category":        wpm_category,
        "filler_count":        filler_count,
        "filler_rate":         filler_rate,
        "filler_words_found":  list(set(found_fillers)),
        "hedge_count":         hedge_count,
        "hedge_phrases_found": found_hedges,
        "vocabulary_richness": vocab_richness,
        "avg_sentence_length": avg_sent_len,
    }

def detect_star_structure(transcript: str) -> dict[str, Any]:
    """
    Detect presence of STAR method components using keyword matching.
    Returns a score 0–10 based on how many components are present.
    """
    text = transcript.strip().lower()
    components: dict[str, bool] = {}

    for component, keywords in STAR_KEYWORDS.items():
        components[component] = any(kw in text for kw in keywords)

    present_count = sum(components.values())
    star_score    = round((present_count / 4) * 10, 1)  # 4 components = 10/10

    return {"star_score": star_score, "star_components": components}

# ─── Delivery score fusion ────────────────────────────────────────────────────

def compute_delivery_score(acoustic: dict, lexical: dict, star: dict) -> tuple[float, dict]:
    """
    Fuse acoustic, lexical, and STAR signals into a single 0–10 delivery score.

    Research contribution: this weighted fusion model is the original work.
    Weights are informed by interview communication research literature:
      - Verbal delivery (pace, pauses)    : 30%
      - Vocabulary and fluency            : 30%
      - Confidence signals (fillers/hedge): 20%
      - STAR structure                    : 20%
    """
    # Pace score (0–10): ideal = 10, decreases as WPM deviates from ideal band
    wpm         = lexical["words_per_minute"]
    pace_score  = 10.0 - min(10.0, abs(wpm - 140) / 14)

    # Pause quality (0–10): some pauses are fine, many long pauses = poor
    long_pauses = acoustic["long_pause_count"]
    pause_score = max(0.0, 10.0 - long_pauses * 2.5)

    # Vocabulary richness (0–10): scaled from TTR
    vocab_score = min(10.0, lexical["vocabulary_richness"] * 13)

    # Expressiveness (0–10): pitch variance is a proxy for vocal expressiveness
    pitch_var   = acoustic["pitch_variance"]
    expr_score  = min(10.0, pitch_var / 5)  # normalised heuristic

    # Confidence (0–10): penalise fillers and hedges
    filler_rate = lexical["filler_rate"]
    hedge_count = lexical["hedge_count"]
    conf_score  = max(0.0, 10.0 - (filler_rate * 0.8) - (hedge_count * 0.5))

    # STAR structure
    star_s = star["star_score"]

    breakdown = {
        "pace":          round(pace_score,  2),
        "pauses":        round(pause_score, 2),
        "vocabulary":    round(vocab_score, 2),
        "expressiveness":round(expr_score,  2),
        "confidence":    round(conf_score,  2),
        "star_structure":round(star_s,      2),
    }

    # Weighted composite
    delivery_score = round(
        breakdown["pace"]          * 0.15 +
        breakdown["pauses"]        * 0.15 +
        breakdown["vocabulary"]    * 0.15 +
        breakdown["expressiveness"]* 0.15 +
        breakdown["confidence"]    * 0.20 +
        breakdown["star_structure"]* 0.20,
        2,
    )

    return delivery_score, breakdown

# ─── Endpoint ─────────────────────────────────────────────────────────────────

@app.post("/analyse", response_model=MultimodalResult)
async def analyse(
    audio:      UploadFile = File(...),
    transcript: str        = "",
) -> MultimodalResult:
    """
    Main analysis endpoint.

    Expects:
      - audio      : audio file (wav/webm) from MediaRecorder API
      - transcript : text transcript of the answer (from Whisper on the Node side,
                     or pass raw text if you're doing text-only mode)

    Returns all computed signals plus a composite delivery score.
    """
    # Validate file type
    content_type = audio.content_type or ""
    if not any(t in content_type for t in ["audio", "video", "octet-stream"]):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    # Cap at 10MB to avoid memory issues
    audio_bytes = await audio.read()
    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 10MB)")

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        acoustic = extract_acoustic_features(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Audio processing failed: {str(e)}")

    if not transcript.strip():
        # If no transcript provided, return acoustic-only analysis
        return MultimodalResult(
            duration_seconds    = acoustic["duration_seconds"],
            words_per_minute    = 0.0,
            wpm_category        = "unknown",
            pause_count         = acoustic["pause_count"],
            long_pause_count    = acoustic["long_pause_count"],
            pitch_variance      = acoustic["pitch_variance"],
            energy_variance     = acoustic["energy_variance"],
            filler_count        = 0,
            filler_rate         = 0.0,
            filler_words_found  = [],
            hedge_count         = 0,
            hedge_phrases_found = [],
            vocabulary_richness = 0.0,
            avg_sentence_length = 0.0,
            star_score          = 0.0,
            star_components     = {k: False for k in STAR_KEYWORDS},
            delivery_score      = 0.0,
            delivery_breakdown  = {},
        )

    lexical  = extract_lexical_features(transcript, acoustic["duration_seconds"])
    star     = detect_star_structure(transcript)
    delivery_score, delivery_breakdown = compute_delivery_score(acoustic, lexical, star)

    return MultimodalResult(
        duration_seconds    = acoustic["duration_seconds"],
        words_per_minute    = lexical["words_per_minute"],
        wpm_category        = lexical["wpm_category"],
        pause_count         = acoustic["pause_count"],
        long_pause_count    = acoustic["long_pause_count"],
        pitch_variance      = acoustic["pitch_variance"],
        energy_variance     = acoustic["energy_variance"],
        filler_count        = lexical["filler_count"],
        filler_rate         = lexical["filler_rate"],
        filler_words_found  = lexical["filler_words_found"],
        hedge_count         = lexical["hedge_count"],
        hedge_phrases_found = lexical["hedge_phrases_found"],
        vocabulary_richness = lexical["vocabulary_richness"],
        avg_sentence_length = lexical["avg_sentence_length"],
        star_score          = star["star_score"],
        star_components     = star["star_components"],
        delivery_score      = delivery_score,
        delivery_breakdown  = delivery_breakdown,
    )


@app.get("/health")
def health():
    return {"status": "ok"}