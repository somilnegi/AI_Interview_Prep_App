/**
 * AI Service — Local Ollama
 *
 * Drop-in replacement for the Groq version.
 * Ollama exposes an OpenAI-compatible endpoint at localhost:11434.
 *
 * Make sure Ollama is running:  ollama serve
 * Pull a model first:           ollama pull llama3.2
 *
 * Switch model any time by changing OLLAMA_MODEL in your .env
 * or the fallback default below.
 *
 * Temperature strategy:
 *   chat()       → temperature 0   — used for evaluation, scoring, feedback,
 *                                    summaries. Deterministic output means the
 *                                    same answer gets the same score every time.
 *   chatStream() → temperature 0.7 — used for question generation. A little
 *                                    randomness keeps questions varied across
 *                                    sessions for the same role.
 */

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    || "llama3.2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ollamaRequest(body) {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  return res;
}

// ─── Non-streaming chat ───────────────────────────────────────────────────────

/**
 * Send a full conversation and return the response as a string.
 *
 * temperature: 0 makes scoring deterministic — the same answer submitted
 * twice will always receive the same rubric scores. Without this, Ollama's
 * default temperature (~0.7) introduces randomness that causes the same
 * answer to score 7 in one session and 5 in another.
 *
 * Used by: evaluateAnswer, computeSkillGapMap, getPrediction, feedbackSummary,
 *          JD analysis, JD extraction.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 */
export async function chat(messages) {
  const res = await ollamaRequest({
    model:   OLLAMA_MODEL,
    messages,
    stream:  false,
    options: {
      temperature: 0, // deterministic — critical for consistent scoring
    },
  });

  const data = await res.json();

  const content = data?.message?.content;
  if (!content) throw new Error("Empty response from Ollama");

  return content.trim();
}

// ─── Streaming chat ───────────────────────────────────────────────────────────

/**
 * Stream response tokens to an Express SSE response.
 * Returns the full accumulated text for saving to DB.
 *
 * temperature: 0.7 (Ollama default) kept here intentionally — question
 * generation benefits from variety so the same role doesn't produce
 * identical questions across sessions.
 *
 * Used by: next-question-stream route only.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {import("express").Response} res
 * @returns {Promise<string>}
 */
export async function chatStream(messages, res) {
  const ollamaRes = await ollamaRequest({
    model:   OLLAMA_MODEL,
    messages,
    stream:  true,
    // No options override — keep default temperature for varied questions
  });

  let fullText = "";
  const decoder = new TextDecoder();

  for await (const chunk of ollamaRes.body) {
    const lines = decoder.decode(chunk).split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const token  = parsed?.message?.content ?? "";

        if (token) {
          fullText += token;
          res.write(`data: ${JSON.stringify(token)}\n\n`);
        }

        if (parsed.done) {
          res.write("data: [DONE]\n\n");
          res.end();
          return fullText;
        }
      } catch {
        // skip malformed chunk
      }
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
  return fullText;
}