import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import History from "../models/History.js";

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate interview questions
router.post("/question", async (req, res) => {
  try {
    const { role, difficulty } = req.body;

    const prompt = `Generate 5 ${difficulty || "medium"} level interview questions for the role: ${role}. 
    Provide them as plain text, one per line.`

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);

    const text = result.response.text();

    res.json({ questions: text });
  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Evaluate user answer (auth removed)
router.post("/evaluate", async (req, res) => {
  try {
    const { question, answer, role } = req.body;

    const prompt = `
Evaluate the following interview answer.

Question: ${question}
Answer: ${answer}

Respond ONLY in JSON format like this:
{
  "score": 0-10,
  "keyMistakes": "list mistakes",
  "improvedAnswer": "a better version of the answer"
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(prompt);

    const evaluation = result.response.text();

    // Save result
    await History.create({
      userId: "TEMP_USER",
      role,
      question,
      userAnswer: answer,
      evaluation: evaluation,
    });

    res.json({ evaluation });
  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch history
router.get("/history", async (req, res) => {
  try {
    const data = await History.find({ userId: "TEMP_USER" }).sort({ createdAt: -1 });

    res.json({ history: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
