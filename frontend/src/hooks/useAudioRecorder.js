import { useState, useRef, useCallback } from "react";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

// Max recording duration — prevents huge blobs that crash librosa
const MAX_RECORDING_MS = 120_000; // 2 minutes

// Warn (but don't hard-block) if blob exceeds this size
const BLOB_WARN_BYTES = 5 * 1024 * 1024; // 5 MB

export function useAudioRecorder({ onTranscriptUpdate } = {}) {
  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState(null);
  const [speechSupported]           = useState(() => !!SpeechRecognition);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const recognitionRef   = useRef(null);
  const transcriptRef    = useRef("");
  const autoStopTimer    = useRef(null); // tracks the max-duration timeout

  // ── KEY FIX: mirror audioBlob in a ref so submitAnswer always gets the
  // latest value synchronously, even if called immediately after stop().
  // React state updates are async — the ref is always current.
  const audioBlobRef = useRef(null);

  const setBlobBoth = (blob) => {
    audioBlobRef.current = blob;
    setAudioBlob(blob);
  };

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current   = [];
      transcriptRef.current = "";
      setBlobBoth(null);

      // ── MediaRecorder ──────────────────────────────────────────────────
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        if (blob.size > BLOB_WARN_BYTES) {
          console.warn(
            `[AudioRecorder] Large blob: ${(blob.size / 1024 / 1024).toFixed(1)} MB. ` +
            `Consider shorter recordings for faster analysis.`
          );
        }

        setBlobBoth(blob); // updates both ref (sync) and state (async)
        stream.getTracks().forEach((t) => t.stop());

        // Clear the auto-stop timer if stop() was called manually first
        if (autoStopTimer.current) {
          clearTimeout(autoStopTimer.current);
          autoStopTimer.current = null;
        }
      };

      mr.start(250);
      mediaRecorderRef.current = mr;

      // ── Auto-stop after MAX_RECORDING_MS ──────────────────────────────
      // Prevents runaway recordings that produce blobs too large for
      // the Python sidecar to process without crashing librosa.
      autoStopTimer.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          console.warn("[AudioRecorder] Max duration reached — stopping automatically.");
          mediaRecorderRef.current.stop();
          recognitionRef.current?.stop();
          recognitionRef.current = null;
          setRecording(false);
        }
      }, MAX_RECORDING_MS);

      // ── SpeechRecognition ──────────────────────────────────────────────
      if (SpeechRecognition) {
        const sr = new SpeechRecognition();
        sr.continuous      = true;
        sr.interimResults  = true;
        sr.lang            = "en-US";

        sr.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              transcriptRef.current += text + " ";
            } else {
              interim = text;
            }
          }
          if (onTranscriptUpdate) {
            onTranscriptUpdate((transcriptRef.current + interim).trimStart());
          }
        };

        sr.onerror = (e) => {
          // "aborted" fires when recognition is stopped programmatically
          // or due to silence — not a real error, safe to ignore
          if (e.error === "aborted") return;

          // "no-speech" means silence timeout — also non-fatal
          if (e.error === "no-speech") {
            console.warn("[AudioRecorder] No speech detected — transcript may be empty.");
            return;
          }

          // Real errors worth surfacing (e.g. "not-allowed", "service-not-allowed")
          console.error("[AudioRecorder] SpeechRecognition error:", e.error);
        };

        sr.start();
        recognitionRef.current = sr;
      }

      setRecording(true);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        console.error("[AudioRecorder] Microphone permission denied.");
      } else {
        console.error("[AudioRecorder] Mic error:", err);
      }
    }
  }, [onTranscriptUpdate]);

  const stop = useCallback(() => {
    // Clear auto-stop timer — manual stop came first
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }

    mediaRecorderRef.current?.stop(); // triggers onstop → setBlobBoth
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    setBlobBoth(null);
    chunksRef.current     = [];
    transcriptRef.current = "";
  }, []);

  // Expose ref so callers can read blob synchronously (avoids race condition)
  return {
    recording,
    audioBlob,
    audioBlobRef,
    speechSupported,
    transcriptRef,  // expose so InterviewPage can read final transcript
    start,
    stop,
    reset,
  };
}