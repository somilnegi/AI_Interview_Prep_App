import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  role: { type: String, required: true },
  difficulty: { type: String, default: "medium" },
  currentQuestionNumber: { type: Number, default: 0 },
  maxQuestions: { type: Number, default: 5 },

  questions: [{
    questionText: String,
    userAnswer: String,
    aiEvaluation: String,
    score: Number
  }],

  totalScore: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  feedbackSummary: String
}, { timestamps: true });


export default mongoose.model("Interview", interviewSchema);
