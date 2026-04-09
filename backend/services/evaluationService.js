import { chat } from "./aiService.js";

// ─── Rubric weights per question type ────────────────────────────────────────

const WEIGHTS_BEHAVIOURAL = {
  clarity: 0.15,
  depth: 0.25,
  relevance: 0.2,
  communication: 0.1,
  starStructure: 0.2,
  specificity: 0.1,
};

const WEIGHTS_TECHNICAL = {
  clarity: 0.2,
  depth: 0.35,
  relevance: 0.25,
  communication: 0.1,
  starStructure: 0.0,
  specificity: 0.1,
};

const WEIGHTS_GENERAL = {
  clarity: 0.15,
  depth: 0.3,
  relevance: 0.25,
  communication: 0.1,
  starStructure: 0.1,
  specificity: 0.1,
};

// ─── Question type detection ──────────────────────────────────────────────────

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

export function detectQuestionType(questionText) {
  const q = questionText.toLowerCase().trim();
  if (BEHAVIOURAL_SIGNALS.some((s) => q.includes(s))) return "behavioural";
  if (TECHNICAL_SIGNALS.some((s) => q.includes(s))) return "technical";
  return "general";
}

// ─── Anchor examples (few-shot calibration) ───────────────────────────────────

const ANCHORS_BEHAVIOURAL = `
ANCHOR EXAMPLES — BEHAVIOURAL:
Strong: "In my last role, a teammate and I disagreed on the API design. I scheduled a sync, prepared a pros/cons doc, and we agreed on REST. Feature shipped on time."
→ clarity=9, depth=7, relevance=9, communication=9, starStructure=9, specificity=9

Weak: "I usually try to talk to the person and sort it out."
→ clarity=5, depth=2, relevance=4, communication=4, starStructure=1, specificity=1
`.trim();

const ANCHORS_TECHNICAL = `
ANCHOR EXAMPLES — TECHNICAL:
Strong (let vs const): "Both are block-scoped unlike var. const prevents reassignment but doesn't make objects immutable — you can still mutate properties. Use const by default, let only when you need to reassign."
→ clarity=9, depth=9, relevance=10, communication=9, starStructure=5, specificity=9

Weak: "const can't be changed and let can."
→ clarity=5, depth=2, relevance=6, communication=4, starStructure=5, specificity=3
`.trim();

const ANCHORS_GENERAL = `
ANCHOR EXAMPLES — GENERAL:
Strong: "I'd start by reading the README and tracing a request end-to-end. I'd run the tests before touching anything. In my previous job I onboarded onto a legacy Rails monolith in under a week this way."
→ clarity=9, depth=7, relevance=9, communication=8, starStructure=6, specificity=8

Weak: "I'd just look around the code and figure it out."
→ clarity=4, depth=2, relevance=5, communication=3, starStructure=1, specificity=1
`.trim();

// ─── Main evaluation function ─────────────────────────────────────────────────

export async function evaluateAnswer(
  role,
  questionText,
  userAnswer,
  difficulty,
) {
  const safeAnswer = userAnswer.trim().slice(0, 2000);
  const safeQuestion = questionText.trim().slice(0, 500);

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

  const starInstruction =
    questionType === "technical"
      ? `- starStructure: TECHNICAL question — score exactly 5 (not applicable). Do NOT penalise for lack of STAR. Do NOT mention STAR in feedback.`
      : questionType === "behavioural"
        ? `- starStructure (0-10): STAR IS expected. 10=full S→T→A→R, 5=partial, 1=none.`
        : `- starStructure (0-10): Helpful but not required. 5=neutral/not applicable.`;

  const messages = [
    {
      role: "system",
      content: `You are a strict but fair interview evaluator for a ${role} position.
This is a ${questionType.toUpperCase()} question.
Score the candidate's answer across SIX dimensions (0–10).
Return ONLY valid JSON. No backticks, no markdown, no extra text.

Dimensions:
- clarity       (0-10): How clearly communicated?
- depth         (0-10): Technical depth and real understanding?
- relevance     (0-10): Directly addresses the question?
- communication (0-10): Professional vocabulary and tone?
${starInstruction}
- specificity   (0-10): Concrete examples vs vague generalisations?

${anchors}

Return this JSON structure:
{
  "clarity": number,
  "depth": number,
  "relevance": number,
  "communication": number,
  "starStructure": number,
  "specificity": number,
  "keyMistakes": "max 2 sentences: what was missing or wrong",
  "improvedAnswer": "concise model answer, max 4 sentences",
  "strengthHighlight": "1 sentence: the best thing about this answer"
}`,
    },
    {
      role: "user",
      content: `Difficulty: ${difficulty}\nQuestion type: ${questionType}\nQuestion: ${safeQuestion}\nAnswer: ${safeAnswer}`,
    },
  ];

  const raw = await chat(messages);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    throw new Error("No JSON found in rubric evaluation response");

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
    starStructure:
      questionType === "technical" ? 5 : clamp(parsed.starStructure),
    specificity: clamp(parsed.specificity),
  };

  const composite = parseFloat(
    Object.entries(weights)
      .reduce((sum, [dim, weight]) => sum + (rubric[dim] || 0) * weight, 0)
      .toFixed(2),
  );

  return {
    rubric,
    score: composite,
    questionType,
    keyMistakes: (parsed.keyMistakes || "").slice(0, 500),
    improvedAnswer: (parsed.improvedAnswer || "").slice(0, 1000),
    strengthHighlight: (parsed.strengthHighlight || "").slice(0, 300),
  };
}

// ─── Skill gap map ────────────────────────────────────────────────────────────

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
    // Exclude technical questions from starStructure average (always forced to 5)
    const relevant =
      dim === "starStructure"
        ? withRubric.filter(
            (q) => detectQuestionType(q.questionText || "") !== "technical",
          )
        : withRubric;

    const values = relevant
      .map((q) => q.rubric[dim])
      .filter((v) => v !== undefined && v !== null);

    averages[dim] = values.length
      ? parseFloat(
          (values.reduce((s, v) => s + v, 0) / values.length).toFixed(2),
        )
      : null;
  }

  const weakAreas = dims.filter(
    (d) => averages[d] !== null && averages[d] < WEAK_THRESHOLD,
  );
  const strongAreas = dims.filter(
    (d) => averages[d] !== null && averages[d] >= WEAK_THRESHOLD,
  );

  return { averages, weakAreas, strongAreas };
}
