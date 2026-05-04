"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const itemRoutes_1 = __importDefault(require("./routes/itemRoutes"));
const onboardingRoutes_1 = __importDefault(require("./routes/onboardingRoutes"));
const plannerRoutes_1 = __importDefault(require("./routes/plannerRoutes"));
const processRoutes_1 = __importDefault(require("./routes/processRoutes"));
const recommendRoutes_1 = __importDefault(require("./routes/recommendRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const saveRoutes_1 = __importDefault(require("./routes/saveRoutes"));
const weeklyPlannerJob_1 = require("./jobs/weeklyPlannerJob");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
}));
app.use(express_1.default.json());
// Static files
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../public/uploads")));
app.use("/processed", express_1.default.static(path_1.default.join(__dirname, "../public/processed")));
// Routes
app.use("/api/auth", authRoutes_1.default);
app.use("/api/items", itemRoutes_1.default);
app.use("/api/onboarding", onboardingRoutes_1.default);
app.use("/api/planner", plannerRoutes_1.default);
app.use("/api/process", processRoutes_1.default);
app.use("/api/recommend", recommendRoutes_1.default);
app.use("/api/upload", uploadRoutes_1.default);
app.use("/api/save", saveRoutes_1.default);
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    (0, weeklyPlannerJob_1.startWeeklyPlannerJob)();
});
