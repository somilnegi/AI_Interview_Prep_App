import { chat } from "./aiService.js";

// ─── Rubric Weights by Question Type ─────────────────────────────────────────
//
// STAR structure is only meaningful for behavioural questions.
// For technical questions (explain, compare, define) STAR is irrelevant —
// zeroing its weight and redistributing to depth/clarity avoids unfair penalisation.
//
// Weights must sum to 1.0 for each type.

const WEIGHTS_BEHAVIOURAL = {
  clarity: 0.15,
  depth: 0.25,
  relevance: 0.2,
  communication: 0.1,
  starStructure: 0.2, // STAR is the primary signal for behavioural answers
  specificity: 0.1,
};

const WEIGHTS_TECHNICAL = {
  clarity: 0.2,
  depth: 0.35, // depth matters most for technical questions
  relevance: 0.25,
  communication: 0.1,
  starStructure: 0.0, // irrelevant — do NOT penalise
  specificity: 0.1,
};

const WEIGHTS_GENERAL = {
  clarity: 0.15,
  depth: 0.3,
  relevance: 0.25,
  communication: 0.1,
  starStructure: 0.1, // partial credit — helpful but not required
  specificity: 0.1,
};

// ─── Question Type Detection ──────────────────────────────────────────────────
//
// Classify questions so we can apply the right rubric weights and
// give the LLM the right instruction about STAR scoring.

const BEHAVIOURAL_SIGNALS = [
  "tell me about a time",
  "describe a situation",
  "describe a time",
  "give me an example",
  "give an example",
  "have you ever",
  "when did you",
  "how did you handle",
  "how did you deal",
  "what did you do when",
  "talk about a time",
  "share an experience",
  "walk me through a time",
  "can you recall a time",
  "think of a time",
];

const TECHNICAL_SIGNALS = [
  "what is",
  "what are",
  "what's the difference",
  "difference between",
  "explain",
  "how does",
  "how do",
  "define",
  "what do you know about",
  "how would you implement",
  "how would you design",
  "write a",
  "write the",
  "what happens when",
  "why does",
  "why do",
  "compare",
  "what is the complexity",
  "what does",
  "when would you use",
  "when should you use",
  "pros and cons",
  "advantages",
  "disadvantages",
];

/**
 * Classify a question as behavioural, technical, or general.
 * @param {string} questionText
 * @returns {"behavioural" | "technical" | "general"}
 */
export function detectQuestionType(questionText) {
  const q = questionText.toLowerCase().trim();

  const isBehavioural = BEHAVIOURAL_SIGNALS.some((s) => q.includes(s));
  if (isBehavioural) return "behavioural";

  const isTechnical = TECHNICAL_SIGNALS.some((s) => q.includes(s));
  if (isTechnical) return "technical";

  return "general";
}

// ─── Anchor Examples ──────────────────────────────────────────────────────────
// Separate anchor sets per question type so the LLM is calibrated correctly
// and doesn't confuse STAR scoring across types.

const ANCHORS_BEHAVIOURAL = `
ANCHOR EXAMPLES for BEHAVIOURAL questions:

Example 1 — Strong answer:
Answer: "In my last role, a teammate and I disagreed on the API design. I scheduled a 30-min sync, prepared a comparison doc with pros/cons, and we agreed on a REST approach. The feature shipped on time and my manager praised the documentation."
Expected: clarity=9, depth=7, relevance=9, communication=9, starStructure=9, specificity=9

Example 2 — Weak answer:
Answer: "I usually try to talk to the person and sort it out. I think communication is important in teams."
Expected: clarity=5, depth=2, relevance=4, communication=4, starStructure=1, specificity=1
`.trim();

const ANCHORS_TECHNICAL = `
ANCHOR EXAMPLES for TECHNICAL questions:

Example 1 — Strong answer (difference between let and const):
Answer: "Both let and const are block-scoped, unlike var which is function-scoped. The key difference is that const binds a variable to a value that cannot be reassigned — so const x = 5 means x can never point to a different value. let allows reassignment. Note that const does not make objects immutable — you can still mutate object properties. Use const by default and only reach for let when you know you need to reassign."
Expected: clarity=9, depth=9, relevance=10, communication=9, starStructure=5, specificity=9

Example 2 — Weak answer:
Answer: "const can't be changed and let can."
Expected: clarity=5, depth=2, relevance=6, communication=4, starStructure=5, specificity=3

Example 3 — Strong answer (algorithm question):
Answer: "I'd use a min-heap to track the k largest elements. Insertion is O(log k) and we maintain exactly k elements so space is O(k). Total time is O(n log k) which beats sorting at O(n log n) for large n."
Expected: clarity=9, depth=9, relevance=10, communication=8, starStructure=5, specificity=9

Example 4 — Weak answer:
Answer: "I would sort the array and pick from it."
Expected: clarity=5, depth=3, relevance=6, communication=4, starStructure=5, specificity=3
`.trim();

const ANCHORS_GENERAL = `
ANCHOR EXAMPLES for GENERAL / SITUATIONAL questions:

Example 1 — Strong answer:
Answer: "If I were given an unfamiliar codebase I'd start by reading the README and any architecture docs, then trace a single user-facing request end-to-end through the stack. I'd set up the dev environment and run the tests before touching anything. In my previous job I used this approach to onboard onto a legacy Rails monolith in under a week."
Expected: clarity=9, depth=7, relevance=9, communication=8, starStructure=6, specificity=8

Example 2 — Weak answer:
Answer: "I'd just look around the code and figure it out."
Expected: clarity=4, depth=2, relevance=5, communication=3, starStructure=1, specificity=1
`.trim();

// ─── Main Evaluation Function ─────────────────────────────────────────────────

/**
 * Rubric-based answer evaluation with question-type-aware scoring.
 *
 * Key improvement over v1:
 *   - Detects question type (behavioural / technical / general)
 *   - Applies appropriate rubric weights per type
 *   - Gives LLM explicit STAR instructions per type so it doesn't
 *     penalise a perfect technical answer for lacking STAR format
 *   - Returns questionType so the frontend can hide irrelevant bars
 *
 * @param {string} role
 * @param {string} questionText
 * @param {string} userAnswer
 * @param {string} difficulty
 * @returns {Promise<EvaluationResult>}
 */
export async function evaluateAnswer(
  role,
  questionText,
  userAnswer,
  difficulty,
) {
  const safeAnswer = userAnswer.trim().slice(0, 2000);
  const safeQuestion = questionText.trim().slice(0, 500);

  // ── Detect question type ─────────────────────────────────────────────────
  const questionType = detectQuestionType(safeQuestion);

  const weights =
    questionType === "behavioural"
      ? WEIGHTS_BEHAVIOURAL
      : questionType === "technical"
        ? WEIGHTS_TECHNICAL
        : WEIGHTS_GENERAL;

  const anchors =
    questionType === "behavioural"
      ? ANCHORS_BEHAVIOURAL
      : questionType === "technical"
        ? ANCHORS_TECHNICAL
        : ANCHORS_GENERAL;

  // ── STAR instruction varies by type ──────────────────────────────────────
  const starInstruction =
    questionType === "technical"
      ? `- starStructure: This is a TECHNICAL question. STAR format is NOT applicable here.
         Score this dimension exactly 5 for every answer regardless of content.
         Do NOT penalise the candidate for not using STAR format.
         Do NOT mention STAR in keyMistakes or improvedAnswer.`
      : questionType === "behavioural"
        ? `- starStructure (0-10): STAR format IS expected for this behavioural question.
         10 = full Situation→Task→Action→Result clearly present.
         5  = partial (some components present but incomplete).
         1  = no structure at all.`
        : `- starStructure (0-10): STAR is helpful but not required for this question type.
         Award partial credit if the answer has some narrative structure.
         5 = neutral / not applicable.`;

  const messages = [
    {
      role: "system",
      content: `You are a strict but fair interview evaluator for a ${role} position.
This is a ${questionType.toUpperCase()} question.
Score the candidate's answer across SIX dimensions on a scale of 0–10.
Return ONLY valid JSON. No backticks, no markdown, no extra text.

Dimension definitions:
- clarity       (0-10): How clearly is the answer communicated?
- depth         (0-10): Technical depth and completeness. Real understanding?
- relevance     (0-10): How directly does it address the specific question?
- communication (0-10): Professional vocabulary, sentence structure, appropriate tone.
${starInstruction}
- specificity   (0-10): Concrete examples, numbers, names vs vague generalisations.

${anchors}

JSON structure to return:
{
  "clarity": number,
  "depth": number,
  "relevance": number,
  "communication": number,
  "starStructure": number,
  "specificity": number,
  "keyMistakes": "string (max 2 sentences: what was missing or wrong)",
  "improvedAnswer": "string (concise model answer, max 4 sentences)",
  "strengthHighlight": "string (1 sentence: the best thing about this answer)"
}`,
    },
    {
      role: "user",
      content: `Difficulty level: ${difficulty}
Question type: ${questionType}
Question: ${safeQuestion}
Candidate answer: ${safeAnswer}`,
    },
  ];

  const raw = await chat(messages);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in rubric evaluation response");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Invalid JSON in rubric evaluation response");
  }

  const clamp = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));

  const rubric = {
    clarity: clamp(parsed.clarity),
    depth: clamp(parsed.depth),
    relevance: clamp(parsed.relevance),
    communication: clamp(parsed.communication),
    // For technical questions the LLM is instructed to return 5 — we force it anyway
    starStructure:
      questionType === "technical" ? 5 : clamp(parsed.starStructure),
    specificity: clamp(parsed.specificity),
  };

  // Weighted composite using type-appropriate weights
  const composite = parseFloat(
    Object.entries(weights)
      .reduce((sum, [dim, weight]) => sum + (rubric[dim] || 0) * weight, 0)
      .toFixed(2),
  );

  return {
    rubric,
    score: composite,
    questionType, // ← NEW: passed to frontend
    keyMistakes: (parsed.keyMistakes || "").slice(0, 500),
    improvedAnswer: (parsed.improvedAnswer || "").slice(0, 1000),
    strengthHighlight: (parsed.strengthHighlight || "").slice(0, 300),
  };
}

// ─── Skill Gap Map ────────────────────────────────────────────────────────────

/**
 * Compute skill gap map from all answered questions.
 * Excludes starStructure from weak/strong area classification for
 * technical questions so they don't skew the overall skill gap map.
 *
 * @param {Array<{rubric: object, questionText: string}>} questions
 * @returns {SkillGapMap | null}
 */
export function computeSkillGapMap(questions) {
  const withRubric = questions.filter((q) => q.rubric);
  if (withRubric.length === 0) return null;

  const dims = [
    "clarity",
    "depth",
    "relevance",
    "communication",
    "starStructure",
    "specificity",
  ];

  const WEAK_THRESHOLD = 6;
  const averages = {};

  for (const dim of dims) {
    // For starStructure: only average across behavioural/general questions
    // (technical questions are forced to 5 and would skew the average)
    const relevantQuestions =
      dim === "starStructure"
        ? withRubric.filter((q) => {
            const t = detectQuestionType(q.questionText || "");
            return t !== "technical";
          })
        : withRubric;

    const values = relevantQuestions
      .map((q) => q.rubric[dim])
      .filter((v) => v !== undefined && v !== null);

    if (values.length === 0) {
      averages[dim] = null;
      continue;
    }

    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    averages[dim] = parseFloat(avg.toFixed(2));
  }

  const weakAreas = dims.filter(
    (d) => averages[d] !== null && averages[d] < WEAK_THRESHOLD,
  );
  const strongAreas = dims.filter(
    (d) => averages[d] !== null && averages[d] >= WEAK_THRESHOLD,
  );

  return { averages, weakAreas, strongAreas };
}
