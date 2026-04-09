import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { chat } from "../services/aiService.js";

const router = express.Router();

/**
 * POST /api/job-description/analyze
 *
 * Novelty feature: Job Description Analyzer.
 *
 * The user pastes a raw job description. This endpoint:
 *   1. Extracts required technical skills, soft skills, and experience keywords
 *   2. Generates role-specific interview questions tailored to that JD
 *   3. Returns a readiness checklist the user can work through
 *
 * This turns the app from a generic question generator into a
 * job-specific interview coach — a key differentiator.
 *
 * Body: { jobDescription: string, difficulty?: "easy"|"medium"|"hard" }
 */
router.post("/analyze", authMiddleware, async (req, res) => {
  try {
    const { jobDescription, difficulty = "medium" } = req.body;

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({
        error:
          "Job description is too short. Paste the full JD for best results.",
      });
    }

    // Trim to 4000 chars to keep the prompt efficient
    const jdText = jobDescription.trim().slice(0, 4000);

    const messages = [
      {
        role: "system",
        content: `You are an expert technical recruiter and interview coach.
Analyze the job description and return ONLY valid JSON. No backticks, no markdown, no extra text.
Structure:
{
  "role": "string (inferred job title)",
  "technicalSkills": ["string", ...],
  "softSkills": ["string", ...],
  "experienceKeywords": ["string", ...],
  "tailoredQuestions": [
    { "question": "string", "skillTested": "string", "difficulty": "easy|medium|hard" },
    ...
  ],
  "readinessChecklist": [
    { "item": "string", "why": "string" },
    ...
  ]
}
Generate 8 tailored interview questions and 5 readiness checklist items.
Match question difficulty to: ${difficulty}.`,
      },
      {
        role: "user",
        content: `Job Description:\n${jdText}`,
      },
    ];

    const raw = await chat(messages);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in JD analysis response");

    const parsed = JSON.parse(jsonMatch[0]);

    res.json({
      role: parsed.role || "Unknown",
      technicalSkills: parsed.technicalSkills || [],
      softSkills: parsed.softSkills || [],
      experienceKeywords: parsed.experienceKeywords || [],
      tailoredQuestions: parsed.tailoredQuestions || [],
      readinessChecklist: parsed.readinessChecklist || [],
    });
  } catch (err) {
    console.error("JD Analysis Error:", err);
    res.status(500).json({ error: "Failed to analyze job description" });
  }
});

/**
 * POST /api/job-description/start-from-jd
 *
 * Convenience endpoint: analyze a JD and immediately start an interview
 * session seeded with the extracted role and tailored questions.
 *
 * Body: { jobDescription: string, difficulty?: string, maxQuestions?: number }
 *
 * Returns: { interviewId, role, extractedSkills }
 * The frontend then calls /api/interview/next-question as normal.
 */
router.post("/start-from-jd", authMiddleware, async (req, res) => {
  try {
    const {
      jobDescription,
      difficulty = "medium",
      maxQuestions = 8,
    } = req.body;

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({ error: "Job description is too short." });
    }

    const jdText = jobDescription.trim().slice(0, 4000);

    // Step 1: Extract role and skills from JD
    const extractMessages = [
      {
        role: "system",
        content: `Extract the job role and top 5 required technical skills from the job description.
Return ONLY valid JSON. No backticks, no markdown.
Structure: { "role": "string", "skills": ["string", ...] }`,
      },
      { role: "user", content: jdText },
    ];

    const extractRaw = await chat(extractMessages);
    const extractMatch = extractRaw.match(/\{[\s\S]*\}/);
    if (!extractMatch) throw new Error("Failed to extract JD info");

    const { role, skills } = JSON.parse(extractMatch[0]);
    const cleanRole = (role || "Software Engineer").trim();
    const skillList = (skills || []).slice(0, 5).join(", ");

    // Step 2: Build interview with JD-aware system prompt
    const Interview = (await import("../models/Interview.js")).default;
    const validDifficulty = ["easy", "medium", "hard"].includes(difficulty)
      ? difficulty
      : "medium";
    const validMax = Math.min(Math.max(parseInt(maxQuestions) || 8, 1), 20);

    const systemMessage = `You are an expert technical interviewer conducting a ${validDifficulty} level interview for a ${cleanRole} position.
The candidate is applying for a role that requires: ${skillList}.
Focus your questions on these specific skills and technologies.
Ask ONE interview question at a time.
Return ONLY the question text with no extra commentary, greetings, or explanations.`;

    const interview = await Interview.create({
      user: req.user.id,
      role: cleanRole,
      difficulty: validDifficulty,
      maxQuestions: validMax,
      status: "ongoing",
      resumeBased: false,
      conversationHistory: [{ role: "system", content: systemMessage }],
    });

    res.status(201).json({
      interviewId: interview._id,
      role: cleanRole,
      extractedSkills: skills || [],
    });
  } catch (err) {
    console.error("Start from JD Error:", err);
    res.status(500).json({ error: "Failed to start JD-based interview" });
  }
});

export default router;
