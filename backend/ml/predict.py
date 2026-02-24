import sys
import joblib
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "model.pkl")

model = joblib.load(model_path)

avgScore = float(sys.argv[1])
difficulty = int(sys.argv[2])

input_data = np.array([[avgScore, difficulty]])

prediction = model.predict(input_data)[0]
probability = model.predict_proba(input_data)[0][1]  # probability of class 1

confidence = round(probability * 100, 2)

print(f"{prediction},{confidence}")