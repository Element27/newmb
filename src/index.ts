import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

import authRoutes from "./routes/authRoutes";
import itemRoutes from "./routes/itemRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import plannerRoutes from "./routes/plannerRoutes";
import processRoutes from "./routes/processRoutes";
import recommendRoutes from "./routes/recommendRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import saveRoutes from "./routes/saveRoutes";
import { startWeeklyPlannerJob } from "./jobs/weeklyPlannerJob";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
        exposedHeaders: ["Set-Cookie"],
    })
);
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
