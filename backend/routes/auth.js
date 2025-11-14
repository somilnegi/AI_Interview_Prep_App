import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// Signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) return res.json({ error: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    name,
    email,
    password: hashed
  });

  res.json({ message: "Signup successful" });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ error: "Incorrect password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.json({ message: "Login successful", token });
});

export default router;
