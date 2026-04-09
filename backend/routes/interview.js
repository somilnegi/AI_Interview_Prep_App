import express from "express";
import Interview from "../models/Interview.js";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getPrediction } from "../services/predictionService.js";
import { chat, chatStream } from "../services/aiService.js";
import {
  evaluateAnswer,
  computeSkillGapMap,
  detectQuestionType,
} from "../services/evaluationService.js";
import {
  updateTheta,
  thetaToDifficultyLabel,
  thetaToAbilityDescription,
  defaultIrtParams,
  shouldStopAdapting,
} from "../services/irtService.js";

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify interview ownership and status in one call. */
async function loadInterview(interviewId, userId, requireOngoing = true) {
  const interview = await Interview.findById(interviewId);
  if (!interview) {
    const err = new Error("Interview not found");
    err.status = 404;
    throw err;
  }
  if (interview.user.toString() !== userId) {
    const err = new Error("Unauthorized access");
    err.status = 403;
    throw err;
  }
  if (requireOngoing && interview.status === "completed") {
    const err = new Error("Interview already completed");
    err.status = 400;
    throw err;
  }
  return interview;
}

/** Build the LLM user message for requesting the next question. */
function buildQuestionPrompt(interview) {
  const qNum = interview.currentQuestionNumber + 1;
  const total = interview.maxQuestions;
  const difficultyLabel = thetaToDifficultyLabel(interview.theta);

  return {
    role: "user",
    content:
      `Ask question number ${qNum} of ${total}. ` +
      `Calibrate difficulty to: ${difficultyLabel}. ` +
      `Candidate ability level: theta=${interview.theta.toFixed(2)}. ` +
      `Return ONLY the question text.`,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/interview/stats
 */
router.get("/stats", authMiddleware, async (req, res, next) => {
  try {
    const completed = await Interview.find({
      user: req.user.id,
      status: "completed",
    })
      .sort({ updatedAt: -1 })
      .lean();

    const totalInterviews = completed.length;
    const bestScore =
      totalInterviews > 0
        ? Math.max(...completed.map((i) => i.averageScore ?? 0))
        : null;
    const lastSessionScore =
      totalInterviews > 0 ? completed[0].averageScore : null;
    const bestTheta =
      totalInterviews > 0
        ? Math.max(...completed.map((i) => i.theta ?? 0))
        : null;

    res.json({ totalInterviews, bestScore, lastSessionScore, bestTheta });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interview/history
 */
router.get("/history", authMiddleware, async (req, res, next) => {
  try {
    const interviews = await Interview.find({
      user: req.user.id,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .select(
        "role difficulty averageScore totalScore theta thetaHistory abilityLevel " +
          "readinessPrediction confidenceScore feedbackSummary skillGapMap " +
          "maxQuestions resumeBased createdAt",
      )
      .lean();

    res.json({ interviews });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/start
 */
router.post("/start", authMiddleware, async (req, res, next) => {
  try {
    const { role, difficulty, maxQuestions, useResume } = req.body;

    if (!role || role.trim() === "") {
      return res.status(400).json({ error: "Role is required" });
    }

    const validDifficulty = ["easy", "medium", "hard"].includes(difficulty)
      ? difficulty
      : "medium";

    const validMaxQuestions = Math.min(
      Math.max(parseInt(maxQuestions) || 5, 1),
      20,
    );

    let resumeContext = "";
    let resumeBased = false;

    if (useResume === true) {
      const user = await User.findById(req.user.id).select("resumeText");
      if (user?.resumeText) {
        resumeContext =
          `\n\nThe candidate has provided their resume. Use it to ask specific, ` +
          `personalised questions about their experience, skills, and projects.\n\n` +
          `Resume:\n${user.resumeText}`;
        resumeBased = true;
      }
    }

    const initialTheta =
      { easy: -1.0, medium: 0.0, hard: 1.0 }[validDifficulty] ?? 0.0;

    const systemMessage =
      `You are an expert technical interviewer conducting an interview for a ${role.trim()} position.\n` +
      `Ask ONE interview question at a time.\n` +
      `Mix question types: include both technical questions (explain concepts, compare approaches) ` +
      `and behavioural questions (tell me about a time...) appropriate to the role.\n` +
      `The session uses adaptive difficulty — question complexity will be calibrated to the candidate's performance.\n` +
      `Return ONLY the question text with no extra commentary, greetings, or explanations.` +
      resumeContext;

    const interview = await Interview.create({
      user: req.user.id,
      role: role.trim(),
      difficulty: validDifficulty,
      maxQuestions: validMaxQuestions,
      status: "ongoing",
      resumeBased,
      theta: initialTheta,
      thetaHistory: [],
      thetaSE: 999,
      thetaTotalInfo: 0,
      conversationHistory: [{ role: "system", content: systemMessage }],
    });

    res.status(201).json({
      interviewId: interview._id,
      resumeBased,
      initialTheta,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interview/next-question-stream/:interviewId
 */
router.get(
  "/next-question-stream/:interviewId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const interview = await loadInterview(
        req.params.interviewId,
        req.user.id,
      );

      if (interview.questions.length >= 1) {
        const lastQ = interview.questions[interview.questions.length - 1];
        if (!lastQ.userAnswer) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.write(`data: ${JSON.stringify(lastQ.questionText)}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
      }

      if (interview.currentQuestionNumber >= interview.maxQuestions) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.write(`data: [FINISHED]\n\n`);
        res.end();
        return;
      }

      const userMsg = buildQuestionPrompt(interview);
      const messages = [...interview.conversationHistory, userMsg];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");

      const questionText = await chatStream(messages, res);

      const questionIrtParams = defaultIrtParams(
        thetaToDifficultyLabel(interview.theta),
      );

      interview.conversationHistory.push(userMsg, {
        role: "assistant",
        content: questionText,
      });
      interview.questions.push({ questionText, irtParams: questionIrtParams });
      interview.currentQuestionNumber += 1;

      await interview.save();
    } catch (err) {
      if (!res.headersSent) next(err);
      else console.error("[next-question-stream]", err);
    }
  },
);

/**
 * POST /api/interview/next-question (non-streaming fallback)
 */
router.post("/next-question", authMiddleware, async (req, res, next) => {
  try {
    const { interviewId } = req.body;
    const interview = await loadInterview(interviewId, req.user.id);

    if (interview.questions.length >= 1) {
      const lastQ = interview.questions[interview.questions.length - 1];
      if (!lastQ.userAnswer) {
        return res.json({ question: lastQ.questionText });
      }
    }

    if (interview.currentQuestionNumber >= interview.maxQuestions) {
      return res.json({ message: "Interview finished" });
    }

    const userMsg = buildQuestionPrompt(interview);
    const messages = [...interview.conversationHistory, userMsg];
    const questionText = await chat(messages);

    const questionIrtParams = defaultIrtParams(
      thetaToDifficultyLabel(interview.theta),
    );

    interview.conversationHistory.push(userMsg, {
      role: "assistant",
      content: questionText,
    });
    interview.questions.push({ questionText, irtParams: questionIrtParams });
    interview.currentQuestionNumber += 1;

    await interview.save();

    res.json({
      question: questionText,
      currentTheta: interview.theta,
      difficultyLabel: thetaToDifficultyLabel(interview.theta),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/evaluate
 *
 * Now detects question type and applies type-appropriate rubric weights.
 * Returns questionType so the frontend can hide irrelevant rubric bars.
 */
router.post("/evaluate", authMiddleware, async (req, res, next) => {
  try {
    const { interviewId, answer } = req.body;

    if (!answer || answer.trim() === "") {
      return res.status(400).json({ error: "Answer is required" });
    }

    const interview = await loadInterview(interviewId, req.user.id);

    const lastQuestion = interview.questions[interview.questions.length - 1];
    if (!lastQuestion) {
      return res.status(400).json({ error: "No question to evaluate" });
    }
    if (lastQuestion.userAnswer) {
      return res
        .status(400)
        .json({ error: "This question has already been evaluated" });
    }

    // 1. Rubric evaluation — now type-aware
    const currentDifficultyLabel = thetaToDifficultyLabel(interview.theta);
    const evaluation = await evaluateAnswer(
      interview.role,
      lastQuestion.questionText,
      answer,
      currentDifficultyLabel,
    );

    // 2. Persist answer + rubric
    lastQuestion.userAnswer        = answer.trim().slice(0, 5000);
    lastQuestion.aiEvaluation      = evaluation.keyMistakes;
    lastQuestion.strengthHighlight = evaluation.strengthHighlight;
    lastQuestion.improvedAnswer    = evaluation.improvedAnswer;
    lastQuestion.score             = evaluation.score;
    lastQuestion.rubric            = evaluation.rubric;

    interview.conversationHistory.push({ role: "user", content: answer });

    // 3. IRT theta update
    const answeredItems = interview.questions
      .filter((q) => q.score !== undefined)
      .map((q) => ({ score: q.score, irtParams: q.irtParams }));

    const { theta, se, totalInfo } = updateTheta(
      answeredItems,
      interview.theta,
    );

    lastQuestion.thetaAtAnswer  = theta;
    interview.theta             = theta;
    interview.thetaSE           = se;
    interview.thetaTotalInfo    = totalInfo;
    interview.thetaHistory.push(theta);
    interview.abilityLevel      = thetaToAbilityDescription(theta);
    interview.difficulty        = thetaToDifficultyLabel(theta);

    const adaptationComplete = shouldStopAdapting(
      se,
      answeredItems.length,
      interview.maxQuestions,
    );

    await interview.save();

    res.json({
      score:             evaluation.score,
      rubric:            evaluation.rubric,
      questionType:      evaluation.questionType,   // ← NEW
      keyMistakes:       evaluation.keyMistakes,
      strengthHighlight: evaluation.strengthHighlight,
      improvedAnswer:    evaluation.improvedAnswer,
      theta,
      thetaSE:           se,
      abilityLevel:      interview.abilityLevel,
      currentDifficulty: interview.difficulty,
      adaptationComplete,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/end
 */
router.post("/end", authMiddleware, async (req, res, next) => {
  try {
    const { interviewId } = req.body;
    const interview = await loadInterview(interviewId, req.user.id);

    const answeredQuestions = interview.questions.filter(
      (q) => q.score !== undefined,
    );
    if (answeredQuestions.length === 0) {
      return res.status(400).json({ error: "No questions answered" });
    }

    const total   = answeredQuestions.reduce((s, q) => s + q.score, 0);
    const average = parseFloat((total / answeredQuestions.length).toFixed(2));

    interview.totalScore  = total;
    interview.averageScore = average;
    interview.skillGapMap  = computeSkillGapMap(answeredQuestions);

    const mlResult = getPrediction(
      interview.theta,
      average,
      interview.skillGapMap,
    );
    interview.readinessPrediction = mlResult.prediction;
    interview.confidenceScore     = mlResult.confidence;
    interview.abilityLevel        = thetaToAbilityDescription(interview.theta);

    const weakAreas   = interview.skillGapMap?.weakAreas?.join(", ")  || "none";
    const strongAreas = interview.skillGapMap?.strongAreas?.join(", ") || "none";
    const keyIssues   = answeredQuestions
      .map((q) => q.aiEvaluation)
      .filter(Boolean)
      .join(" | ");

    const summaryMessages = [
      {
        role: "system",
        content:
          "You are an interview performance analyst. Write a concise 2–3 sentence summary. " +
          "Be constructive and specific. Mention the ability level and key improvement areas.",
      },
      {
        role: "user",
        content:
          `Interview role: ${interview.role}\n` +
          `Questions answered: ${answeredQuestions.length}\n` +
          `Average score: ${average}/10\n` +
          `Final IRT ability (theta): ${interview.theta.toFixed(2)} — ${interview.abilityLevel}\n` +
          `Strong areas: ${strongAreas}\n` +
          `Weak areas: ${weakAreas}\n` +
          `Prediction: ${mlResult.prediction} (${mlResult.confidence}% confidence)\n` +
          `Rationale: ${mlResult.rationale}\n` +
          `Key issues: ${keyIssues}`,
      },
    ];

    interview.feedbackSummary = await chat(summaryMessages);
    interview.status          = "completed";

    await interview.save();

    const user    = await User.findById(req.user.id);
    const newTotal = user.totalInterviews + 1;
    const newAvg   = parseFloat(
      ((user.averagePerformance * user.totalInterviews + average) / newTotal).toFixed(2),
    );

    const dims = [
      "clarity", "depth", "relevance", "communication", "starStructure", "specificity",
    ];
    const newSkillHistory   = {};
    const sessionAverages   = interview.skillGapMap?.averages || {};
    for (const dim of dims) {
      const prev  = user.skillHistory?.[dim] ?? 0;
      const fresh = sessionAverages[dim]     ?? 0;
      newSkillHistory[dim] = parseFloat(
        ((prev * user.totalInterviews + fresh) / newTotal).toFixed(2),
      );
    }

    const newBestTheta =
      user.bestTheta === null || user.bestTheta === undefined
        ? interview.theta
        : Math.max(user.bestTheta, interview.theta);

    await User.findByIdAndUpdate(req.user.id, {
      $inc:  { totalInterviews: 1 },
      $push: { interviews: interview._id, thetaHistory: interview.theta },
      $set:  {
        averagePerformance: newAvg,
        bestTheta:          newBestTheta,
        skillHistory:       newSkillHistory,
      },
    });

    res.json({
      totalScore:         interview.totalScore,
      averageScore:       interview.averageScore,
      theta:              interview.theta,
      thetaHistory:       interview.thetaHistory,
      abilityLevel:       interview.abilityLevel,
      skillGapMap:        interview.skillGapMap,
      readinessPrediction:interview.readinessPrediction,
      confidenceScore:    interview.confidenceScore,
      predictionRationale:mlResult.rationale,
      feedbackSummary:    interview.feedbackSummary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/interview/:interviewId
 */
router.get("/:interviewId", authMiddleware, async (req, res, next) => {
  try {
    const interview = await loadInterview(
      req.params.interviewId,
      req.user.id,
      false,
    );

    res.json({
      _id:                interview._id,
      role:               interview.role,
      difficulty:         interview.difficulty,
      status:             interview.status,
      totalScore:         interview.totalScore,
      averageScore:       interview.averageScore,
      theta:              interview.theta,
      thetaHistory:       interview.thetaHistory,
      thetaSE:            interview.thetaSE,
      abilityLevel:       interview.abilityLevel,
      skillGapMap:        interview.skillGapMap,
      readinessPrediction:interview.readinessPrediction,
      confidenceScore:    interview.confidenceScore,
      feedbackSummary:    interview.feedbackSummary,
      maxQuestions:       interview.maxQuestions,
      resumeBased:        interview.resumeBased,
      createdAt:          interview.createdAt,
      questions:          interview.questions,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
