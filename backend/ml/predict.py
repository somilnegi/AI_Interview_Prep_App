import sys
import joblib
import numpy as np
import os

try:
    # -----------------------------
    # Validate arguments
    # -----------------------------
    if len(sys.argv) != 3:
        print("0,0")
        sys.exit(1)

    avgScore = float(sys.argv[1])
    difficulty = int(sys.argv[2])

    # -----------------------------
    # Input validation
    # -----------------------------
    if not (0 <= avgScore <= 10):
        print("0,0")
        sys.exit(1)

    if difficulty not in [1, 2, 3]:
        print("0,0")
        sys.exit(1)

    # -----------------------------
    # Load model safely
    # -----------------------------
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(BASE_DIR, "model.pkl")

    model = joblib.load(model_path)

    # -----------------------------
    # Make prediction
    # -----------------------------
    input_data = np.array([[avgScore, difficulty]])

    prediction = model.predict(input_data)[0]
    probability = model.predict_proba(input_data)[0][1]

    confidence = round(probability * 100, 2)

    # Always print in fixed format
    print(f"{prediction},{confidence}")

except Exception as e:
    # Never crash Node
    print("0,0")