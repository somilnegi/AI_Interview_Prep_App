import express from "express";
import ollama from "ollama";
import Interview from "../models/Interview.js";
import auth from "../middleware/auth.js";
import { getPrediction } from "../services/mlService.js";

const router = express.Router();

function difficultyToNumber(level) {
  if (level === "easy") return 1;
  if (level === "medium") return 2;
  if (level === "hard") return 3;
}

// ==========================
// START INTERVIEW
// ==========================
router.post("/start", auth, async (req, res) => {
  try {
    const { role, difficulty } = req.body;

    const interview = await Interview.create({
      user: req.user.id,
      role,
      difficulty: difficulty || "medium",
      currentQuestionNumber: 0,
      maxQuestions: 5,
    });

    res.status(201).json({ interviewId: interview._id });
  } catch (err) {
    res.status(500).json({ error: "Failed to start interview" });
  }
});

// ==========================
// GENERATE NEXT QUESTION (Adaptive)
// ==========================
router.post("/next-question", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    // Security check
    if (interview.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Unauthorized access" });

    if (interview.currentQuestionNumber >= interview.maxQuestions) {
      return res.json({ message: "Interview finished" });
    }

    const prompt = `
Generate ONE ${interview.difficulty} level interview question 
for a ${interview.role}.
Return only the question.
`;

    const result = await ollama.generate({
      model: "gemma3:4b",
      prompt,
    });

    interview.currentQuestionNumber += 1;
    await interview.save();

    res.json({ question: result.response });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate question" });
  }
});

// ==========================
// EVALUATE ANSWER + ADAPT
// ==========================
router.post("/evaluate", auth, async (req, res) => {
  try {
    const { interviewId, question, answer } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    if (interview.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Unauthorized access" });

    const prompt = `
You are an AI interview evaluator. 
Return STRICT JSON only.

{
 "score": number (0-10),
 "keyMistakes": "string",
 "improvedAnswer": "string"
}

Question: ${question}
Answer: ${answer}
`;

    const result = await ollama.generate({
      model: "gemma3:4b",
      prompt,
    });

    let parsed;
    try {
      parsed = JSON.parse(result.response);
    } catch {
      return res.status(500).json({ error: "Invalid AI response format" });
    }

    // Store question
    interview.questions.push({
      questionText: question,
      userAnswer: answer,
      aiEvaluation: parsed.keyMistakes,
      score: parsed.score,
    });

    // ==========================
    // ADAPTIVE DIFFICULTY LOGIC
    // ==========================
    if (parsed.score >= 8 && interview.difficulty !== "hard") {
      interview.difficulty =
        interview.difficulty === "easy" ? "medium" : "hard";
    }

    if (parsed.score <= 4 && interview.difficulty !== "easy") {
      interview.difficulty =
        interview.difficulty === "hard" ? "medium" : "easy";
    }

    await interview.save();

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// ==========================
// END INTERVIEW + CALCULATE
// ==========================
router.post("/end", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    if (interview.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Unauthorized access" });

    if (interview.questions.length === 0)
      return res.status(400).json({ error: "No questions answered" });

    const total = interview.questions.reduce((sum, q) => sum + q.score, 0);

    interview.totalScore = total;
    interview.averageScore = total / interview.questions.length;

    await interview.save();

    // =====================
    // ML PREDICTION PART
    // =====================

    const difficultyNumber = difficultyToNumber(interview.difficulty);

    const mlResult = await getPrediction(
      interview.averageScore,
      difficultyNumber,
    );

    res.json({
      totalScore: interview.totalScore,
      averageScore: interview.averageScore,
      readinessPrediction: mlResult.prediction === "1" ? "READY" : "NOT READY",
      confidenceScore: mlResult.confidence,
    });
  } catch (err) {
    console.error("End Interview Error:", err);
    res.status(500).json({ error: "Failed to end interview" });
  }
});

export default router;
