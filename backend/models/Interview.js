import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * 6-dimension rubric score per answer.
 * Added starStructure + specificity for research novelty.
 */
const rubricSchema = new mongoose.Schema(
  {
    clarity:       { type: Number, min: 0, max: 10 },
    depth:         { type: Number, min: 0, max: 10 },
    relevance:     { type: Number, min: 0, max: 10 },
    communication: { type: Number, min: 0, max: 10 },
    starStructure: { type: Number, min: 0, max: 10 }, // STAR method compliance
    specificity:   { type: Number, min: 0, max: 10 }, // Concrete vs vague
  },
  { _id: false },
);

/**
 * IRT parameters stored per question so we can calibrate them later
 * using real response data (mirt / girth in Python/R).
 */
const irtParamsSchema = new mongoose.Schema(
  {
    a: { type: Number, default: 1.0 }, // discrimination
    b: { type: Number, default: 0.0 }, // difficulty
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    questionText:      { type: String, required: true },
    userAnswer:        { type: String },
    aiEvaluation:      { type: String },   // keyMistakes
    strengthHighlight: { type: String },   // what they did well
    improvedAnswer:    { type: String },
    score:             { type: Number, min: 0, max: 10 },
    rubric:            { type: rubricSchema, default: null },

    // IRT data for this item — used to update theta after answer
    irtParams:         { type: irtParamsSchema, default: () => ({ a: 1.0, b: 0.0 }) },

    // Theta at the time this question was answered (for trajectory chart)
    thetaAtAnswer:     { type: Number },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ["system", "user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

/**
 * Skill gap map — now 6 dimensions including STAR and specificity.
 */
const skillGapSchema = new mongoose.Schema(
  {
    averages: {
      clarity:       Number,
      depth:         Number,
      relevance:     Number,
      communication: Number,
      starStructure: Number,
      specificity:   Number,
    },
    weakAreas:   [String],
    strongAreas: [String],
  },
  { _id: false },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    // Static difficulty label — shown to user, also used as fallback for LLM
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "expert"],
      default: "medium",
    },

    status: {
      type: String,
      enum: ["ongoing", "completed"],
      default: "ongoing",
    },

    currentQuestionNumber: { type: Number, default: 0 },
    maxQuestions:          { type: Number, default: 5 },

    questions:           [questionSchema],
    conversationHistory: [messageSchema],

    // ── IRT / CAT Fields ────────────────────────────────────────────────────

    /**
     * Current theta (ability estimate). Updated after every answered question.
     * Range: [-3, +3]. Starts at 0 (prior: average ability).
     */
    theta: {
      type: Number,
      default: 0.0,
      min: -3,
      max: 3,
    },

    /**
     * History of theta values — one entry per answered question.
     * Enables the frontend to draw an ability trajectory chart.
     */
    thetaHistory: {
      type: [Number],
      default: [],
    },

    /**
     * Standard error of the current theta estimate.
     * High SE = uncertain estimate. Decreases as more questions are answered.
     */
    thetaSE: {
      type: Number,
      default: 999,
    },

    /**
     * Total Fisher Information accumulated so far.
     * Used to compute SE and decide when to stop adapting.
     */
    thetaTotalInfo: {
      type: Number,
      default: 0,
    },

    /**
     * Human-readable ability level derived from theta.
     * E.g. "Advanced (top 20%)"
     */
    abilityLevel: {
      type: String,
      default: null,
    },

    // ── Scoring & Outcome ───────────────────────────────────────────────────

    totalScore:    { type: Number, default: 0 },
    averageScore:  { type: Number, default: 0 },
    skillGapMap:   { type: skillGapSchema, default: null },

    readinessPrediction: {
      type: String,
      enum: ["READY", "NOT READY"],
    },

    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    feedbackSummary: String,

    resumeBased: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Interview", interviewSchema);
