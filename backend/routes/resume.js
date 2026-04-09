import express from "express";
import multer from "multer";
import { createRequire } from "module";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const require = createRequire(import.meta.url);
const PDFParser = require("pdf2json");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are supported"));
    }
  },
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Extract plain text from a PDF buffer using pdfjs-dist.
 * Works on text-based PDFs. Returns empty string for image-based/scanned PDFs.
 */
async function extractTextFromPDF(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      const text = pdfParser
        .getRawTextContent()
        .replace(/\r\n|\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      resolve(text);
    });

    pdfParser.on("pdfParser_dataError", (err) => {
      reject(new Error(err.parserError || "PDF parse failed"));
    });

    pdfParser.parseBuffer(buffer);
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/resume/upload
 * Parse uploaded PDF and store extracted text on the user document.
 */
router.post(
  "/upload",
  authMiddleware,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      let fullText;
      try {
        fullText = await extractTextFromPDF(req.file.buffer);
      } catch (parseErr) {
        console.error("PDF parse error:", parseErr.message);
        return res.status(400).json({
          error:
            "Could not read this PDF. Make sure it is a text-based PDF, not a scanned image.",
        });
      }

      if (!fullText || fullText.length < 50) {
        return res.status(400).json({
          error:
            "Could not extract text from this PDF. " +
            "Make sure it is a text-based PDF (not scanned or image-only). " +
            "Try exporting from Google Docs or Microsoft Word.",
        });
      }

      // Trim to 3000 chars to keep AI prompts efficient
      const resumeText = fullText.slice(0, 3000);

      await User.findByIdAndUpdate(req.user.id, { resumeText });

      res.json({
        message: "Resume uploaded successfully",
        wordCount: resumeText.split(/\s+/).length,
      });
    } catch (err) {
      if (err.message === "Only PDF files are supported") {
        return res.status(400).json({ error: err.message });
      }
      console.error("Resume Upload Error:", err);
      res.status(500).json({ error: "Failed to process resume" });
    }
  },
);

/**
 * DELETE /api/resume
 * Remove stored resume text from the user document.
 */
router.delete("/", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $unset: { resumeText: "" } });
    res.json({ message: "Resume removed" });
  } catch (err) {
    console.error("Resume Delete Error:", err);
    res.status(500).json({ error: "Failed to remove resume" });
  }
});

/**
 * GET /api/resume/status
 * Check whether the user has an uploaded resume.
 */
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("resumeText");
    res.json({
      hasResume: !!user?.resumeText,
      wordCount: user?.resumeText ? user.resumeText.split(/\s+/).length : 0,
    });
  } catch (err) {
    console.error("Resume Status Error:", err);
    res.status(500).json({ error: "Failed to check resume status" });
  }
});

export default router;
