from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib
import os

# -------------------------------
# Training Data
# Features:
# [averageScore (0-10), difficultyLevel (1-3)]
# -------------------------------

X = [
    [3.0, 1],
    [4.5, 1],
    [5.0, 2],
    [6.0, 2],
    [6.5, 2],
    [7.0, 2],
    [7.5, 3],
    [8.0, 3],
    [8.5, 3],
    [9.0, 3],
    [4.0, 1],
    [5.5, 2],
    [6.8, 2],
    [7.2, 3],
    [9.5, 3]
]

# 0 = Not Ready, 1 = Ready
y = [
    0, 0, 0, 1, 1,
    1, 1, 1, 1, 1,
    0, 0, 1, 1, 1
]

# -------------------------------
# Create Pipeline (Scaler + Model)
# -------------------------------

model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", LogisticRegression(random_state=42))
])

model.fit(X, y)

# -------------------------------
# Save Model Safely
# -------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "model.pkl")

joblib.dump(model, model_path)

print("Model trained and saved successfully.")