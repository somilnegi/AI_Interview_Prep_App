import express from "express";
import OpenAI from "openai";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// Generate interview question
router.post("/question", async (req, res) => {
  const { role } = req.body;

  const prompt = `Generate one interview question for role: ${role}.`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }]
  });

  res.json({
    question: response.choices[0].message.content
  });
});

// Evaluate user answer
router.post("/evaluate", async (req, res) => {
  const { question, answer } = req.body;

  const evaluationPrompt = `
Evaluate this interview answer.

Question: ${question}
Answer: ${answer}

Give feedback in this structure:
1. Score (0-10)
2. Key mistakes
3. Final improved answer
`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: evaluationPrompt }]
  });

  res.json({
    evaluation: response.choices[0].message.content
  });
});

export default router;
