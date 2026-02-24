import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    userAnswer: { type: String },
    aiEvaluation: { type: String },
    score: { type: Number, min: 0, max: 10 },
  },
  { _id: false },
);

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

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    status: {
      type: String,
      enum: ["ongoing", "completed"],
      default: "ongoing",
    },

    currentQuestionNumber: {
      type: Number,
      default: 0,
    },

    maxQuestions: {
      type: Number,
      default: 5,
    },

    questions: [questionSchema],

    totalScore: {
      type: Number,
      default: 0,
    },

    averageScore: {
      type: Number,
      default: 0,
    },

    // 🔥 ML Fields
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
  },
  { timestamps: true },
);

export default mongoose.model("Interview", interviewSchema);
