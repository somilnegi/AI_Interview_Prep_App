import mongoose from "mongoose";

const historySchema = new mongoose.Schema({
  userId: { type: String, ref: "User", required: true },
  role: { type: String, required: true },
  question: { type: String, required: true },
  userAnswer: { type: String, required: true },
  evaluation: { type: String },
}, { timestamps: true });

export default mongoose.model("History", historySchema);
