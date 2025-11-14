// This starts the app(backend), sets up middleware, and defines a simple route.
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import interviewRoutes from "./routes/interview.js";

dotenv.config();

connectDB();

const app = express();
app.use(cors()); //avoids browser CORS errors for requests from your frontend domain.
app.use(express.json()); //parses JSON bodies (API uses JSON).
app.use("/auth", authRoutes);
app.use("/interview", interviewRoutes);

app.get("/", (req, res) => {
    //Health route (/) helps verify the server is up (useful for monitors / load balancers).
  res.send("API Working");
});

app.listen(5000, () => console.log("Server running on port 5000"));
