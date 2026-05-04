"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWeeklyPlannerJob = runWeeklyPlannerJob;
exports.startWeeklyPlannerJob = startWeeklyPlannerJob;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_1 = require("../config/supabase");
const plannerController_1 = require("../controllers/plannerController");
const weeklyPlanner_1 = require("../utils/weeklyPlanner");
function getStateFile() {
    return path_1.default.join(__dirname, "../../data/weeklyPlannerJobState.json");
}
function readState() {
    const file = getStateFile();
    if (!fs_1.default.existsSync(file))
        return {};
    try {
        return JSON.parse(fs_1.default.readFileSync(file, "utf-8"));
    }
    catch {
        return {};
    }
}
function writeState(state) {
    const file = getStateFile();
    const dir = path_1.default.dirname(file);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(file, JSON.stringify(state, null, 2));
}
async function getEligibleUserIds() {
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (!supabase)
        return [];
    const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("onboarding_completed", true);
    if (error || !data)
        return [];
    return data.map((row) => String(row.user_id)).filter(Boolean);
}
async function runWeeklyPlannerJob(force = false) {
    const now = new Date();
    const isSaturday = now.getDay() === 6;
    if (!force && !isSaturday)
        return;
    const todayISO = (0, weeklyPlanner_1.toISODate)(now);
    const state = readState();
    if (!force && state.lastRunSaturday === todayISO)
        return;
    const userIds = await getEligibleUserIds();
    if (userIds.length === 0) {
        if (isSaturday) {
            writeState({ lastRunSaturday: todayISO });
        }
        return;
    }
    const weekStart = (0, weeklyPlanner_1.toISODate)((0, weeklyPlanner_1.getNextMonday)(now));
    await Promise.all(userIds.map((userId) => (0, plannerController_1.generatePlanForUser)(userId, weekStart)));
    if (isSaturday || force) {
        writeState({ lastRunSaturday: todayISO });
    }
}
function startWeeklyPlannerJob() {
    void runWeeklyPlannerJob(false);
    const everyHourMs = 60 * 60 * 1000;
    setInterval(() => {
        void runWeeklyPlannerJob(false);
    }, everyHourMs);
}
