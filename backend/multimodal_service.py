"""
Multimodal Analysis Sidecar — FastAPI service
==============================================

Fuses THREE signal sources into a unified delivery score:
  1. Acoustic features  (librosa)   — pace, pitch variance, pause patterns
  2. Lexical features   (spaCy)     — filler words, hedging, vocabulary richness
  3. STAR cues          (regex/NLP) — Situation/Task/Action/Result detection

Run alongside the Node server:
  uvicorn multimodal_service:app --port 8001 --reload

Install deps:
  pip install fastapi uvicorn python-multipart librosa numpy spacy pydub
  python -m spacy download en_core_web_sm

Requires ffmpeg on system PATH:
  Windows : winget install ffmpeg
  Mac     : brew install ffmpeg
  Linux   : sudo apt install ffmpeg
"""

from __future__ import annotations

import io
import re
import subprocess
import tempfile
import os
from typing import Any

import numpy as np
import librosa
import spacy
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Multimodal Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    raise RuntimeError("Run: python -m spacy download en_core_web_sm")

# ─── ffmpeg path ──────────────────────────────────────────────────────────────
# Set FFMPEG_PATH env variable if ffmpeg is not on system PATH.
# e.g. Windows: set FFMPEG_PATH=C:\path\to\ffmpeg.exe
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")

# ─── Constants ────────────────────────────────────────────────────────────────

WPM_IDEAL_LOW  = 120
WPM_IDEAL_HIGH = 160

FILLERS = {
    "um", "uh", "er", "ah", "like", "you know", "i mean",
    "basically", "literally", "honestly", "actually", "so yeah",
    "kind of", "sort of",
}

HEDGES = {
    "i think", "i guess", "i believe", "maybe", "perhaps",
    "not sure", "possibly", "might be", "could be", "i feel like",
    "in my opinion", "i'm not sure but",
}

STAR_KEYWORDS = {
    "situation": ["when i", "in my previous", "at my last", "while working", "in a project", "there was a situation"],
    "task":      ["i was responsible", "my role was", "i needed to", "i had to", "the goal was", "tasked with"],
    "action":    ["i decided", "i implemented", "i built", "i created", "i worked on", "i collaborated", "i led", "i resolved"],
    "result":    ["as a result", "this led to", "the outcome was", "we achieved", "i improved", "reduced by", "increased by", "successfully"],
}

# ─── Response model ────────────────────────────────────────────────────────────

class MultimodalResult(BaseModel):
    duration_seconds:    float
    words_per_minute:    float
    wpm_category:        str
    pause_count:         int
    long_pause_count:    int
    pitch_variance:      float
    energy_variance:     float
    filler_count:        int
    filler_rate:         float
    filler_words_found:  list[str]
    hedge_count:         int
    hedge_phrases_found: list[str]
    vocabulary_richness: float
    avg_sentence_length: float
    star_score:          float
    star_components:     dict[str, bool]
    delivery_score:      float
    delivery_breakdown:  dict[str, float]

# ─── Audio processing ─────────────────────────────────────────────────────────

def convert_to_wav(audio_bytes: bytes, input_suffix: str = ".webm") -> bytes:
    """
    Convert any browser audio format (webm, ogg, mp4) to 16kHz mono WAV
    using ffmpeg. Required because librosa cannot decode WebM/Opus natively.
    """
    tmp_in  = None
    tmp_out = None
    try:
        with tempfile.NamedTemporaryFile(suffix=input_suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp_in = f.name

        tmp_out = tmp_in.replace(input_suffix, ".wav")

        result = subprocess.run(
            [FFMPEG_PATH, "-y", "-i", tmp_in, "-ar", "16000", "-ac", "1", "-f", "wav", tmp_out],
            capture_output=True,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg failed: {result.stderr.decode('utf-8', errors='replace')}"
            )

        with open(tmp_out, "rb") as f:
            return f.read()

    finally:
        if tmp_in  and os.path.exists(tmp_in):  os.unlink(tmp_in)
        if tmp_out and os.path.exists(tmp_out): os.unlink(tmp_out)


def extract_acoustic_features(audio_bytes: bytes, content_type: str = "") -> dict[str, Any]:
    if "ogg" in content_type:
        suffix = ".ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        suffix = ".mp4"
    else:
        suffix = ".webm"

    wav_bytes = convert_to_wav(audio_bytes, input_suffix=suffix)
    y, sr     = librosa.load(io.BytesIO(wav_bytes), sr=16000, mono=True)
    duration  = librosa.get_duration(y=y, sr=sr)

    frame_length = 2048
    hop_length   = 512
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    silence_threshold = np.percentile(rms, 15)

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
            if pause_len > 0.5: pause_count += 1
            if pause_len > 2.0: long_pauses += 1
            in_pause = False

    f0, _, _       = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"))
    voiced_f0      = f0[~np.isnan(f0)] if f0 is not None else np.array([])
    pitch_variance = float(np.std(voiced_f0)) if len(voiced_f0) > 0 else 0.0
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
    text       = transcript.strip().lower()
    doc        = nlp(text)
    words      = [token.text for token in doc if token.is_alpha]
    word_count = len(words)
    minutes    = max(duration_seconds / 60, 0.01)

    found_fillers = []
    for filler in FILLERS:
        count = len(re.findall(r"\b" + re.escape(filler) + r"\b", text))
        found_fillers.extend([filler] * count)

    filler_count = len(found_fillers)
    filler_rate  = round(filler_count / minutes, 2)

    found_hedges = [h for h in HEDGES if h in text]
    hedge_count  = sum(text.count(h) for h in found_hedges)

    vocab_richness = round(len(set(words)) / max(word_count, 1), 3)

    wpm = round(word_count / minutes, 1)
    wpm_category = (
        "too_slow" if wpm < WPM_IDEAL_LOW else
        "too_fast" if wpm > WPM_IDEAL_HIGH else
        "ideal"
    )

    sentences    = list(doc.sents)
    avg_sent_len = round(
        sum(len([t for t in s if t.is_alpha]) for s in sentences) / max(len(sentences), 1), 1
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
    text       = transcript.strip().lower()
    components = {c: any(kw in text for kw in kws) for c, kws in STAR_KEYWORDS.items()}
    star_score = round((sum(components.values()) / 4) * 10, 1)
    return {"star_score": star_score, "star_components": components}


def compute_delivery_score(acoustic: dict, lexical: dict, star: dict) -> tuple[float, dict]:
    wpm         = lexical["words_per_minute"]
    pace_score  = 10.0 - min(10.0, abs(wpm - 140) / 14)
    pause_score = max(0.0, 10.0 - acoustic["long_pause_count"] * 2.5)
    vocab_score = min(10.0, lexical["vocabulary_richness"] * 13)
    expr_score  = min(10.0, acoustic["pitch_variance"] / 5)
    conf_score  = max(0.0, 10.0 - (lexical["filler_rate"] * 0.8) - (lexical["hedge_count"] * 0.5))
    star_s      = star["star_score"]

    breakdown = {
        "pace":           round(pace_score,  2),
        "pauses":         round(pause_score, 2),
        "vocabulary":     round(vocab_score, 2),
        "expressiveness": round(expr_score,  2),
        "confidence":     round(conf_score,  2),
        "star_structure": round(star_s,      2),
    }

    delivery_score = round(
        breakdown["pace"]           * 0.15 +
        breakdown["pauses"]         * 0.15 +
        breakdown["vocabulary"]     * 0.15 +
        breakdown["expressiveness"] * 0.15 +
        breakdown["confidence"]     * 0.20 +
        breakdown["star_structure"] * 0.20,
        2,
    )

    return delivery_score, breakdown

# ─── Endpoint ─────────────────────────────────────────────────────────────────

@app.post("/analyse", response_model=MultimodalResult)
async def analyse(
    audio:      UploadFile = File(...),
    transcript: str        = Form(default=""),
) -> MultimodalResult:
    content_type = audio.content_type or ""
    if not any(t in content_type for t in ["audio", "video", "octet-stream"]):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    audio_bytes = await audio.read()
    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 10MB)")
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        acoustic = extract_acoustic_features(audio_bytes, content_type)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Audio processing failed: {str(e)}")

    if not transcript.strip():
        return MultimodalResult(
            duration_seconds=acoustic["duration_seconds"], words_per_minute=0.0,
            wpm_category="unknown", pause_count=acoustic["pause_count"],
            long_pause_count=acoustic["long_pause_count"], pitch_variance=acoustic["pitch_variance"],
            energy_variance=acoustic["energy_variance"], filler_count=0, filler_rate=0.0,
            filler_words_found=[], hedge_count=0, hedge_phrases_found=[],
            vocabulary_richness=0.0, avg_sentence_length=0.0, star_score=0.0,
            star_components={k: False for k in STAR_KEYWORDS},
            delivery_score=0.0, delivery_breakdown={},
        )

    lexical = extract_lexical_features(transcript, acoustic["duration_seconds"])
    star    = detect_star_structure(transcript)
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
