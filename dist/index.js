import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import authRoutes from "./routes/authRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import plannerRoutes from "./routes/plannerRoutes.js";
import processRoutes from "./routes/processRoutes.js";
import recommendRoutes from "./routes/recommendRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import saveRoutes from "./routes/saveRoutes.js";
import { startWeeklyPlannerJob } from "./jobs/weeklyPlannerJob.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
}));
app.use(express.json());
// Static files
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));
app.use("/processed", express.static(path.join(__dirname, "../public/processed")));
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/process", processRoutes);
app.use("/api/recommend", recommendRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/save", saveRoutes);
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    startWeeklyPlannerJob();
});
