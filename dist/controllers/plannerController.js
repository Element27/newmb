"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateWeeklyPlanDay = exports.updateWeeklyPlanDay = exports.generateWeeklyPlanHandler = exports.getWeeklyPlan = void 0;
exports.generatePlanForUser = generatePlanForUser;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_1 = require("../config/supabase");
const weeklyPlanner_1 = require("../utils/weeklyPlanner");
const httpSession_1 = require("../auth/httpSession");
function getFallbackFile() {
    return path_1.default.join(__dirname, "../../data/weeklyPlans.json");
}
function readFallbackPlans() {
    const file = getFallbackFile();
    if (!fs_1.default.existsSync(file))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(file, "utf-8"));
    }
    catch {
        return [];
    }
}
function writeFallbackPlans(plans) {
    const file = getFallbackFile();
    const dir = path_1.default.dirname(file);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(file, JSON.stringify(plans, null, 2));
}
function resolveWeekStart(input) {
    if (input && /^\d{4}-\d{2}-\d{2}$/.test(input))
        return input;
    return (0, weeklyPlanner_1.toISODate)((0, weeklyPlanner_1.getNextMonday)(new Date()));
}
function mapItems(data) {
    return (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        colorHex: item.color_hex,
        originalPath: item.original_url,
        processedPath: item.processed_url,
    }));
}
async function loadWardrobeItems(userId) {
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase) {
        const { data, error } = await supabase
            .from("items")
            .select("id,name,category,color_hex,original_url,processed_url")
            .eq("user_id", userId);
        if (!error && data) {
            return mapItems(data);
        }
    }
    return [];
}
async function loadPlan(userId, weekStart) {
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase) {
        const { data, error } = await supabase
            .from("weekly_plans")
            .select("user_id,week_start,days,generated_at,updated_at")
            .eq("user_id", userId)
            .eq("week_start", weekStart)
            .maybeSingle();
        if (!error && data) {
            const row = data;
            return {
                userId: row.user_id,
                weekStart: row.week_start,
                days: row.days || [],
                generatedAt: row.generated_at || new Date().toISOString(),
                updatedAt: row.updated_at || new Date().toISOString(),
            };
        }
    }
    const fallback = readFallbackPlans().find((plan) => plan.userId === userId && plan.weekStart === weekStart);
    return fallback || null;
}
async function savePlan(plan) {
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase) {
        const payload = {
            user_id: plan.userId,
            week_start: plan.weekStart,
            days: plan.days,
            generated_at: plan.generatedAt,
            updated_at: plan.updatedAt,
        };
        const { error } = await supabase
            .from("weekly_plans")
            .upsert(payload, { onConflict: "user_id,week_start" });
        if (!error)
            return;
    }
    const all = readFallbackPlans();
    const existing = all.find((item) => item.userId === plan.userId && item.weekStart === plan.weekStart);
    if (existing) {
        Object.assign(existing, plan);
    }
    else {
        all.push(plan);
    }
    writeFallbackPlans(all);
}
async function generatePlanForUser(userId, weekStart) {
    const items = await loadWardrobeItems(userId);
    const plan = (0, weeklyPlanner_1.generateWeeklyPlan)(userId, items, weekStart);
    await savePlan(plan);
    return plan;
}
const getWeeklyPlan = async (req, res) => {
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const weekStart = resolveWeekStart(req.query.weekStart);
    const plan = await loadPlan(userId, weekStart);
    return res.json({ ok: true, weekStart, plan });
};
exports.getWeeklyPlan = getWeeklyPlan;
const generateWeeklyPlanHandler = async (req, res) => {
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const weekStart = resolveWeekStart(req.body.weekStart);
    const plan = await generatePlanForUser(userId, weekStart);
    return res.json({ ok: true, plan });
};
exports.generateWeeklyPlanHandler = generateWeeklyPlanHandler;
const updateWeeklyPlanDay = async (req, res) => {
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const weekStart = resolveWeekStart(req.body.weekStart);
    const date = String(req.body.date || "");
    if (!date) {
        return res.status(400).json({ ok: false, error: "Missing date" });
    }
    const current = await loadPlan(userId, weekStart);
    if (!current) {
        return res.status(404).json({ ok: false, error: "Plan not found for week" });
    }
    const patch = {};
    if (Array.isArray(req.body.itemIds)) {
        patch.itemIds = req.body.itemIds.map((item) => String(item));
    }
    if (typeof req.body.occasion === "string") {
        patch.occasion = req.body.occasion;
    }
    if (typeof req.body.notes === "string") {
        patch.notes = req.body.notes;
    }
    if (typeof req.body.locked === "boolean") {
        patch.locked = req.body.locked;
    }
    const updated = (0, weeklyPlanner_1.mergePlanDay)(current, date, patch);
    await savePlan(updated);
    return res.json({ ok: true, plan: updated });
};
exports.updateWeeklyPlanDay = updateWeeklyPlanDay;
const regenerateWeeklyPlanDay = async (req, res) => {
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const weekStart = resolveWeekStart(req.body.weekStart);
    const date = String(req.body.date || "");
    if (!date) {
        return res.status(400).json({ ok: false, error: "Missing date" });
    }
    const current = await loadPlan(userId, weekStart);
    const basePlan = current || (await generatePlanForUser(userId, weekStart));
    const targetDay = basePlan.days.find((day) => day.date === date);
    if (!targetDay) {
        return res.status(404).json({ ok: false, error: "Day not found in plan" });
    }
    const items = await loadWardrobeItems(userId);
    const candidates = items.filter((item) => !basePlan.days.some((day) => day.itemIds.includes(item.id) && day.date !== date));
    const source = candidates.length > 0 ? candidates : items;
    const regenerated = (0, weeklyPlanner_1.generateWeeklyPlan)(userId, source, weekStart);
    const replacement = regenerated.days.find((day) => day.date === date);
    if (!replacement) {
        return res.status(500).json({ ok: false, error: "Failed to regenerate day" });
    }
    const merged = (0, weeklyPlanner_1.mergePlanDay)(basePlan, date, {
        occasion: targetDay.occasion,
        itemIds: replacement.itemIds,
        notes: targetDay.notes || "",
        locked: targetDay.locked || false,
    });
    await savePlan(merged);
    return res.json({ ok: true, plan: merged });
};
exports.regenerateWeeklyPlanDay = regenerateWeeklyPlanDay;
