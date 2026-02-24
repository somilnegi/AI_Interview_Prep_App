import { exec } from "child_process";

export function getPrediction(avgScore, difficultyNumber) {
  return new Promise((resolve, reject) => {
    exec(
      `python ./ml/predict.py ${avgScore} ${difficultyNumber}`,
      (err, stdout) => {
        if (err) return reject(err);

        const [prediction, confidence] =
          stdout.trim().split(",");

        resolve({
          prediction,
          confidence: parseFloat(confidence)
        });
      }
    );
  });
}