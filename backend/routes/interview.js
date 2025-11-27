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
You are an AI interview evaluator. Analyze the answer STRICTLY and return ONLY valid JSON. 
Do NOT include backticks, do NOT include markdown.

Question: ${question}
Answer: ${answer}

Return ONLY this exact JSON structure:

{
  "score": number (0-10),
  "keyMistakes": "string",
  "improvedAnswer": "string"
}

Rules:
- "score" must be a number only.
- "keyMistakes" must clearly list what was missing.
- "improvedAnswer" must be a polished, perfect version of the answer.
- Do NOT include triple backticks.
- Do NOT add explanation outside the JSON.
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
