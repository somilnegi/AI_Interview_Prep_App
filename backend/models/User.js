import mongoose from "mongoose";

/**
 * User Schema — updated for IRT-aware session tracking.
 *
 * New fields added:
 *   - thetaHistory   : array of theta values across all completed sessions
 *                      lets the frontend draw a long-term ability growth chart
 *   - bestTheta      : highest theta ever achieved — a cleaner "personal best"
 *                      than averagePerformance alone
 *   - skillHistory   : running average of each rubric dimension across sessions
 *                      powers a cumulative skill radar on the dashboard
 *   - resumeText     : unchanged — parsed PDF text reused per session
 */

const skillHistorySchema = new mongoose.Schema(
  {
    clarity: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    relevance: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    starStructure: { type: Number, default: 0 },
    specificity: { type: Number, default: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // ── Interview history ──────────────────────────────────────────────────

    totalInterviews: {
      type: Number,
      default: 0,
    },

    averagePerformance: {
      type: Number,
      default: 0,
    },

    interviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Interview",
      },
    ],

    // ── IRT ability tracking ───────────────────────────────────────────────

    /**
     * Theta value at the end of each completed session, in order.
     * Used to draw a long-term ability growth curve on the dashboard.
     * E.g. [-0.5, 0.2, 0.8, 1.1] shows the candidate improving over time.
     */
    thetaHistory: {
      type: [Number],
      default: [],
    },

    /**
     * Highest theta value ever achieved across all sessions.
     * A cleaner "personal best" signal than average score.
     */
    bestTheta: {
      type: Number,
      default: null,
    },

    /**
     * Running cumulative average of rubric dimension scores across ALL sessions.
     * Updated at the end of each interview using a rolling average.
     * Powers the long-term skill radar on the user dashboard.
     */
    skillHistory: {
      type: skillHistorySchema,
      default: () => ({}),
    },

    // ── Resume ─────────────────────────────────────────────────────────────

    /**
     * Parsed plain text from the user's uploaded resume.
     * Extracted once on upload, reused for every interview session.
     */
    resumeText: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
