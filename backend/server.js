import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import resumeRoutes from "./routes/resume.js";
import interviewRoutes from "./routes/interview.js";
import jobDescriptionRoutes from "./routes/jobDescription.js";

// ─── DB ───────────────────────────────────────────────────────────────────────

connectDB();

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// General rate limiter — 100 requests per 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Stricter limiter for auth routes — 10 per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later." },
});

app.use(generalLimiter);
app.use(express.json({ limit: "1mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/auth",            authLimiter, authRoutes);
app.use("/api/interview",       interviewRoutes);
app.use("/api/resume",          resumeRoutes);
app.use("/api/job-description", jobDescriptionRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Interview API running" });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────

// Catches anything thrown with next(err) across all routes
app.use((err, req, res, _next) => {
  const status  = err.status  || 500;
  const message = err.message || "Internal server error";

  // Don't leak stack traces in production
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${req.method} ${req.path}]`, err);
  } else if (status >= 500) {
    console.error(`[${req.method} ${req.path}] 500:`, err.message);
  }

  res.status(status).json({ error: message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});
