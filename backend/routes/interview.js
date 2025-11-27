import express from "express";
import History from "../models/History.js";
import ollama from "ollama";

const router = express.Router();

// Generate interview questions
router.post("/question", async (req, res) => {
  try {
    const { role, difficulty } = req.body;

      const prompt = `
  Generate exactly 5 interview questions for a ${role}.
  Do not include explanations, answers, bullet points, formatting, bold text, or extra commentary.
  Output only the 5 questions, each on a new line.
  `;
    const result = await ollama.generate({
      model: "gemma3:4b",
      prompt: prompt
    });

    res.json({ questions: result.response });
  } catch (error) {
    console.error("Ollama Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Evaluate user answer
router.post("/evaluate", async (req, res) => {
  try {
    const { question, answer, role } = req.body;

    const prompt = `
Evaluate this interview answer.

Question: ${question}
Answer: ${answer}

Return feedback ONLY in JSON format:
{
  "score": 0-10,
  "keyMistakes": "...",
  "improvedAnswer": "..."
}
`;

    const result = await ollama.generate({
      model: "gemma3:4b",
      prompt: prompt
    });

    await History.create({
      userId: req.body.userId || "testUser",
      role,
      question,
      userAnswer: answer,
      evaluation: result.response
    });

    res.json({ evaluation: result.response });
  } catch (error) {
    console.error("Evaluation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get history
router.get("/history", async (req, res) => {
  try {
    const data = await History.find({
      userId: req.query.userId || "testUser"
    }).sort({ createdAt: -1 });

    res.json({ history: data });
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
