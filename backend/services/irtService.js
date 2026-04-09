/**
 * IRT Service — Item Response Theory (2-Parameter Logistic Model)
 *
 * This is the core novelty contribution for adaptive difficulty.
 * Instead of simple score thresholds, we model:
 *   - θ  (theta)  : candidate's latent ability, starts at 0, range [-3, +3]
 *   - b  (beta)   : question difficulty,         range [-2, +2]
 *   - a  (alpha)  : question discrimination,     range [0.5, 3]
 *
 * The 2PL probability of a "correct" (good) answer:
 *   P(θ) = 1 / (1 + e^(−a(θ − b)))
 *
 * After each answer we update θ via Maximum Likelihood Estimation (MLE)
 * using Newton–Raphson iteration. The next question is chosen to maximise
 * Fisher Information at the current θ estimate:
 *   I(θ) = a² × P(θ) × (1 − P(θ))
 *
 * Research contribution: applying polytomous IRT (partial-credit scoring
 * on 0–10 rubric) rather than binary IRT to open-ended interview answers.
 * See convertScoreToResponse() for the partial-credit mapping.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const THETA_MIN = -3;
const THETA_MAX = 3;
const THETA_INIT = 0;          // Prior: assume average ability
const SE_STOP_THRESHOLD = 0.35; // Stop adapting when standard error < 0.35
const MLE_ITERATIONS = 20;
const MLE_LEARNING_RATE = 0.5;

// Default IRT parameters for questions that don't have calibrated values yet.
// Discrimination of 1.0 is the standard assumption in uncalibrated banks.
export const DEFAULT_IRT_PARAMS = { a: 1.0, b: 0.0 };

// Difficulty band → IRT b-value mapping
// Used when the LLM prompt needs a difficulty instruction
const DIFFICULTY_TO_B = {
  easy:   -1.2,
  medium:  0.0,
  hard:    1.2,
};

const B_TO_DIFFICULTY = (b) => {
  if (b <= -0.6) return "easy";
  if (b <= 0.6)  return "medium";
  return "hard";
};

// ─── Core IRT Functions ───────────────────────────────────────────────────────

/**
 * 2PL probability of a correct response.
 * @param {number} theta - Candidate ability
 * @param {number} a     - Item discrimination
 * @param {number} b     - Item difficulty
 * @returns {number} Probability in (0, 1)
 */
export function probability(theta, a, b) {
  const exponent = -a * (theta - b);
  // Clamp to avoid overflow on extreme values
  const clampedExp = Math.max(-500, Math.min(500, exponent));
  return 1 / (1 + Math.exp(clampedExp));
}

/**
 * Fisher Information at theta for one item.
 * Higher = more information about the ability at this theta level.
 * @param {number} theta
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function fisherInformation(theta, a, b) {
  const p = probability(theta, a, b);
  return a * a * p * (1 - p);
}

/**
 * Convert a rubric score (0–10) to a pseudo-response for IRT.
 *
 * Standard IRT uses binary (0/1). For open-ended answers we use a
 * partial-credit approach: scores 0–4 = incorrect-leaning, 5–10 = correct-leaning.
 * This is the "graded response model" extension of 2PL.
 *
 * Returns a value in [0, 1] representing response quality.
 * @param {number} score - Composite rubric score 0–10
 * @returns {number}
 */
export function convertScoreToResponse(score) {
  return Math.max(0, Math.min(1, score / 10));
}

/**
 * Standard error of theta estimate.
 * SE(θ) = 1 / sqrt(ΣI(θ))
 * @param {number} totalInformation - Sum of Fisher info across answered items
 * @returns {number}
 */
export function standardError(totalInformation) {
  if (totalInformation <= 0) return 999;
  return 1 / Math.sqrt(totalInformation);
}

// ─── Theta Update (MLE via Newton–Raphson) ───────────────────────────────────

/**
 * Update theta estimate after a new answer using Newton–Raphson MLE.
 *
 * The log-likelihood gradient and Hessian for polytomous responses:
 *   L'(θ)  = Σ a_i × (u_i − P_i)
 *   L''(θ) = −Σ a_i² × P_i × (1 − P_i)
 *
 * θ_new = θ_old − L'(θ) / L''(θ)
 *
 * @param {Array<{score: number, irtParams: {a: number, b: number}}>} answeredItems
 *   All items answered so far, each with its score (0–10) and IRT params.
 * @param {number} currentTheta - Current ability estimate
 * @returns {{ theta: number, se: number, totalInfo: number }}
 */
export function updateTheta(answeredItems, currentTheta) {
  if (answeredItems.length === 0) {
    return { theta: THETA_INIT, se: 999, totalInfo: 0 };
  }

  let theta = currentTheta;

  for (let iter = 0; iter < MLE_ITERATIONS; iter++) {
    let gradient = 0;
    let hessian = 0;

    for (const item of answeredItems) {
      const { a, b } = item.irtParams;
      const u = convertScoreToResponse(item.score); // partial credit response
      const p = probability(theta, a, b);

      gradient += a * (u - p);
      hessian  -= a * a * p * (1 - p);
    }

    // Avoid division by zero (flat likelihood)
    if (Math.abs(hessian) < 1e-8) break;

    const step = (gradient / hessian) * MLE_LEARNING_RATE;
    theta -= step;

    // Clamp within bounds
    theta = Math.max(THETA_MIN, Math.min(THETA_MAX, theta));

    // Convergence check
    if (Math.abs(step) < 1e-5) break;
  }

  // Compute standard error at final theta
  const totalInfo = answeredItems.reduce(
    (sum, item) => sum + fisherInformation(theta, item.irtParams.a, item.irtParams.b),
    0,
  );

  const se = standardError(totalInfo);

  return {
    theta: parseFloat(theta.toFixed(4)),
    se: parseFloat(se.toFixed(4)),
    totalInfo: parseFloat(totalInfo.toFixed(4)),
  };
}

// ─── CAT Question Selection ───────────────────────────────────────────────────

/**
 * Select the next question from a bank using Maximum Fisher Information.
 *
 * Picks the item that gives the most information about the candidate's
 * ability at the current theta estimate. Excludes already-asked questions.
 *
 * @param {number} theta - Current ability estimate
 * @param {Array<{_id: string, irtParams: {a: number, b: number}}>} questionBank
 * @param {Array<string>} askedIds - IDs of already-asked questions
 * @returns {{ selectedId: string, targetDifficulty: string, targetB: number } | null}
 */
export function selectNextQuestion(theta, questionBank, askedIds = []) {
  const askedSet = new Set(askedIds.map(String));
  const available = questionBank.filter((q) => !askedSet.has(String(q._id)));

  if (available.length === 0) return null;

  let bestItem = null;
  let bestInfo = -1;

  for (const item of available) {
    const { a, b } = item.irtParams || DEFAULT_IRT_PARAMS;
    const info = fisherInformation(theta, a, b);
    if (info > bestInfo) {
      bestInfo = info;
      bestItem = item;
    }
  }

  const b = bestItem?.irtParams?.b ?? 0;
  return {
    selectedId: bestItem._id,
    targetDifficulty: B_TO_DIFFICULTY(b),
    targetB: b,
    expectedInfo: parseFloat(bestInfo.toFixed(4)),
  };
}

// ─── Stopping Rule ────────────────────────────────────────────────────────────

/**
 * Check whether the CAT session has converged.
 * Stop if SE < threshold OR all questions have been asked.
 *
 * @param {number} se              - Current standard error of theta
 * @param {number} answeredCount   - Questions answered so far
 * @param {number} maxQuestions    - Hard cap from session settings
 * @returns {boolean}
 */
export function shouldStopAdapting(se, answeredCount, maxQuestions) {
  if (answeredCount >= maxQuestions) return true;
  if (se < SE_STOP_THRESHOLD && answeredCount >= 3) return true;
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a theta value to a human-readable difficulty label
 * for injecting into the LLM question prompt.
 * @param {number} theta
 * @returns {string}
 */
export function thetaToDifficultyLabel(theta) {
  if (theta < -1.0) return "easy";
  if (theta < 0.5)  return "medium";
  if (theta < 1.5)  return "hard";
  return "expert";
}

/**
 * Convert theta to a percentile-like ability description for feedback.
 * @param {number} theta
 * @returns {string}
 */
export function thetaToAbilityDescription(theta) {
  if (theta >= 2.0)  return "Expert (top 5%)";
  if (theta >= 1.0)  return "Advanced (top 20%)";
  if (theta >= 0.0)  return "Proficient (top 50%)";
  if (theta >= -1.0) return "Developing (bottom 50%)";
  if (theta >= -2.0) return "Beginner (bottom 20%)";
  return "Novice (bottom 5%)";
}

/**
 * Build IRT params for a question when no calibrated data is available.
 * Assigns b based on the question's stated difficulty.
 * @param {"easy"|"medium"|"hard"} difficulty
 * @returns {{ a: number, b: number }}
 */
export function defaultIrtParams(difficulty) {
  return {
    a: 1.0,
    b: DIFFICULTY_TO_B[difficulty] ?? 0.0,
  };
}
