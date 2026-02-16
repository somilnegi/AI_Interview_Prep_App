// This starts the app(backend), sets up middleware, and defines a simple route.
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";


import interviewRoutes from "./routes/interview.js";
connectDB();

const app = express();
app.use(cors()); //avoids browser CORS errors for requests from your frontend domain.
app.use(express.json()); //parses JSON bodies (API uses JSON).
app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);

app.get("/", (req, res) => {
    //Health route (/) helps verify the server is up (useful for monitors / load balancers).
  res.send("API Working");
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});