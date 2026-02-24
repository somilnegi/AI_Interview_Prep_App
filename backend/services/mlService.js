import { spawn } from "child_process";

export function getPrediction(avgScore, difficultyNumber) {
  return new Promise((resolve, reject) => {
    // Validate input before calling Python
    if (typeof avgScore !== "number" || typeof difficultyNumber !== "number") {
      return reject(new Error("Invalid ML input values"));
    }

    const pythonProcess = spawn("python", [
      "./ml/predict.py",
      avgScore.toString(),
      difficultyNumber.toString(),
    ]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python error:", errorOutput);
        return reject(new Error("ML process failed"));
      }

      try {
        const [prediction, confidence] = output.trim().split(",");

        resolve({
          prediction,
          confidence: parseFloat(confidence),
        });
      } catch (err) {
        reject(new Error("Invalid ML output format"));
      }
    });
  });
}
