/**
 * Interview Readiness Prediction Service
 *
 * v2: IRT-aware prediction.
 *
 * The old system used raw average score + difficulty bonus.
 * The new system uses theta (the IRT ability estimate) as the primary signal,
 * with the rubric average as a secondary calibrator. This is more principled
 * because theta is already difficulty-adjusted — a score of 7/10 on a hard
 * question contributes more to theta than a 7/10 on an easy question.
 *
 * Research note: the confidence values here are heuristic. Once real user
 * data is collected (responses + eventual job outcomes), this can be replaced
 * with a logistic regression or gradient-boosted classifier trained on theta,
 * skill gap dimensions, and role. The schema already stores all required inputs.
 *
 * @param {number} theta        - IRT ability estimate [-3, +3]
 * @param {number} averageScore - Rubric composite average [0, 10]
 * @param {object} skillGapMap  - { weakAreas: string[], averages: object }
 * @returns {{ prediction: "READY" | "NOT READY", confidence: number, rationale: string }}
 */
export function getPrediction(theta, averageScore, skillGapMap = null) {
  const weakCount = skillGapMap?.weakAreas?.length ?? 0;

  // Penalty for having many weak rubric dimensions
  // (catches cases where theta is inflated by high-discrimination easy questions)
  const weaknessPenalty = weakCount * 0.15;

  // Combined signal: theta dominates (range −3 to +3 → normalise to 0–1)
  const thetaNorm = (theta + 3) / 6; // 0 at θ=−3, 1 at θ=+3
  const scoreFrac = averageScore / 10;

  // Blended signal (70% theta, 30% rubric average)
  const blended = thetaNorm * 0.7 + scoreFrac * 0.3 - weaknessPenalty;

  let prediction, confidence, rationale;

  if (blended >= 0.80) {
    prediction  = "READY";
    confidence  = 95;
    rationale   = "Excellent ability estimate with consistently strong rubric scores.";
  } else if (blended >= 0.65) {
    prediction  = "READY";
    confidence  = 82;
    rationale   = "Good ability estimate. Minor gaps in some dimensions.";
  } else if (blended >= 0.52) {
    prediction  = "READY";
    confidence  = 65;
    rationale   = "Borderline ready. Targeted preparation in weak areas recommended.";
  } else if (blended >= 0.40) {
    prediction  = "NOT READY";
    confidence  = 68;
    rationale   = "Ability estimate below threshold. Depth and specificity need work.";
  } else if (blended >= 0.28) {
    prediction  = "NOT READY";
    confidence  = 80;
    rationale   = "Low ability estimate across most dimensions.";
  } else {
    prediction  = "NOT READY";
    confidence  = 92;
    rationale   = "Significantly below role requirements at this difficulty level.";
  }

  return { prediction, confidence, rationale };
}
