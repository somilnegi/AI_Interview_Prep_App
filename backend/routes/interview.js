import express from "express";
import ollama from "ollama";
import Interview from "../models/Interview.js";
import auth from "../middleware/auth.js";
import { getPrediction } from "../services/mlService.js";

const router = express.Router();

// ==========================
// Difficulty Mapper (Safe)
// ==========================
function difficultyToNumber(level) {
  const map = { easy: 1, medium: 2, hard: 3 };
  return map[level] || 2;
}

// ==========================
// START INTERVIEW
// ==========================
router.post("/start", auth, async (req, res) => {
  try {
    const { role, difficulty } = req.body;

    if (!role || role.trim() === "") {
      return res.status(400).json({ error: "Role is required" });
    }

    const validDifficulty = ["easy", "medium", "hard"].includes(difficulty)
      ? difficulty
      : "medium";

    const interview = await Interview.create({
      user: req.user.id,
      role: role.trim(),
      difficulty: validDifficulty,
      maxQuestions: 5,
      status: "ongoing",
    });

    res.status(201).json({ interviewId: interview._id });
  } catch (err) {
    console.error("Start Interview Error:", err);
    res.status(500).json({ error: "Failed to start interview" });
  }
});

// ==========================
// GENERATE NEXT QUESTION
// ==========================
router.post("/next-question", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    if (interview.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Unauthorized access" });

    if (interview.status === "completed")
      return res.status(400).json({ error: "Interview already completed" });

    if (interview.currentQuestionNumber >= interview.maxQuestions) {
      return res.json({ message: "Interview finished" });
    }

    const prompt = `
Generate ONE ${interview.difficulty} level interview question 
for a ${interview.role}.
Return ONLY the question text.
`;

    const result = await ollama.generate({
      model: "gemma3:4b",
      prompt,
    });

    const questionText = result.response.trim();

    // Store question immediately
    interview.questions.push({
      questionText,
    });

    interview.currentQuestionNumber += 1;

    await interview.save();

    res.json({ question: questionText });
  } catch (err) {
    console.error("Next Question Error:", err);
    res.status(500).json({ error: "Failed to generate question" });
  }
});

// ==========================
// EVALUATE ANSWER + ADAPT
// ==========================
router.post("/evaluate", auth, async (req, res) => {
  try {
    const { interviewId, answer } = req.body;

    if (!answer || answer.trim() === "") {
      return res.status(400).json({ error: "Answer is required" });
    }

    const interview = await Interview.findById(interviewId);

    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    if (interview.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Unauthorized access" });

    if (interview.status === "completed")
      return res.status(400).json({ error: "Interview already completed" });

    const lastQuestion = interview.questions[interview.questions.length - 1];

    if (!lastQuestion)
      return res.status(400).json({ error: "No question to evaluate" });

    const prompt = `
You are an AI interview evaluator.

Return ONLY valid JSON.
Do NOT include backticks.
Do NOT include markdown.
Do NOT include explanation outside JSON.

Structure:
{
  "score": number (0-10),
  "keyMistakes": "string",
  "improvedAnswer": "string"
}

Question: ${lastQuestion.questionText}
Answer: ${answer}
`;

    const result = await ollama.generate({
      model: "gemma3:4b",
      prompt,
    });

    let parsed;
    try {
      parsed = JSON.parse(result.response.trim());
    } catch {
      return res.status(500).json({ error: "Invalid AI response format" });
    }

    const score = Math.max(0, Math.min(10, parsed.score));

    // Update last question
    lastQuestion.userAnswer = answer;
    lastQuestion.aiEvaluation = parsed.keyMistakes;
    lastQuestion.score = score;

    // ==========================
    // Adaptive Logic (Running Average Based)
    // ==========================
    const answeredQuestions = interview.questions.filter(
      (q) => q.score !== undefined,
    );
    const avg =
      answeredQuestions.reduce((s, q) => s + q.score, 0) /
      answeredQuestions.length;

    if (avg >= 8 && interview.difficulty !== "hard") {
      interview.difficulty =
        interview.difficulty === "easy" ? "medium" : "hard";
    }

    if (avg <= 4 && interview.difficulty !== "easy") {
      interview.difficulty =
        interview.difficulty === "hard" ? "medium" : "easy";
    }

    await interview.save();

    res.json({
      score,
      keyMistakes: parsed.keyMistakes,
      improvedAnswer: parsed.improvedAnswer,
    });
  } catch (err) {
    console.error("Evaluation Error:", err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// ==========================
// END INTERVIEW + ML
// ==========================
router.post("/end", auth, async (req, res) => {
  try {
    const { interviewId } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    if (interview.user.toString() !== req.user.id)
      return res.status(403).json({ error: "Unauthorized access" });

    if (interview.status === "completed")
      return res.status(400).json({ error: "Interview already completed" });

    const answeredQuestions = interview.questions.filter(
      (q) => q.score !== undefined,
    );

    if (answeredQuestions.length === 0)
      return res.status(400).json({ error: "No questions answered" });

    const total = answeredQuestions.reduce((sum, q) => sum + q.score, 0);
    const average = total / answeredQuestions.length;

    interview.totalScore = total;
    interview.averageScore = average;

    // =====================
    // ML Prediction
    // =====================
    const difficultyNumber = difficultyToNumber(interview.difficulty);

    const mlResult = await getPrediction(
      interview.averageScore,
      difficultyNumber,
    );

    interview.readinessPrediction =
      mlResult.prediction === "1" ? "READY" : "NOT READY";

    interview.confidenceScore = mlResult.confidence;

    interview.status = "completed";

    await interview.save();

    res.json({
      totalScore: interview.totalScore,
      averageScore: interview.averageScore,
      readinessPrediction: interview.readinessPrediction,
      confidenceScore: interview.confidenceScore,
    });
  } catch (err) {
    console.error("End Interview Error:", err);
    res.status(500).json({ error: "Failed to end interview" });
  }
});

export default router;
