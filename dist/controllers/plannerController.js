import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getSupabaseServer } from "../config/supabase.js";
import { generateWeeklyPlan, getNextMonday, mergePlanDay, toISODate, } from "../utils/weeklyPlanner.js";
import { requireAuthenticatedUser } from "../auth/httpSession.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function getFallbackFile() {
    return path.join(__dirname, "../../data/weeklyPlans.json");
}
function readFallbackPlans() {
    const file = getFallbackFile();
    if (!fs.existsSync(file))
        return [];
    try {
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
    catch {
        return [];
    }
}
function writeFallbackPlans(plans) {
    const file = getFallbackFile();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(plans, null, 2));
}
function resolveWeekStart(input) {
    if (input && /^\d{4}-\d{2}-\d{2}$/.test(input))
        return input;
    return toISODate(getNextMonday(new Date()));
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
    const supabase = getSupabaseServer();
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
async function loadUserPrimaryStyle(userId) {
    const supabase = getSupabaseServer();
    if (supabase) {
        const { data, error } = await supabase
            .from("profiles")
            .select("primary_style")
            .eq("user_id", userId)
            .maybeSingle();
        if (!error && data)
            return data.primary_style ?? null;
    }
    return null;
}
async function loadPlan(userId, weekStart) {
    const supabase = getSupabaseServer();
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
    const supabase = getSupabaseServer();
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
export async function generatePlanForUser(userId, weekStart) {
    const [items, primaryStyle] = await Promise.all([
        loadWardrobeItems(userId),
        loadUserPrimaryStyle(userId),
    ]);
    const plan = generateWeeklyPlan(userId, items, weekStart, primaryStyle);
    await savePlan(plan);
    return plan;
}
export const getWeeklyPlan = async (req, res) => {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const weekStart = resolveWeekStart(req.query.weekStart);
    const plan = await loadPlan(userId, weekStart);
    return res.json({ ok: true, weekStart, plan });
};
export const generateWeeklyPlanHandler = async (req, res) => {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const weekStart = resolveWeekStart(req.body.weekStart);
    const plan = await generatePlanForUser(userId, weekStart);
    return res.json({ ok: true, plan });
};
export const updateWeeklyPlanDay = async (req, res) => {
    const authUser = await requireAuthenticatedUser(req, res);
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
    const updated = mergePlanDay(current, date, patch);
    await savePlan(updated);
    return res.json({ ok: true, plan: updated });
};
export const regenerateWeeklyPlanDay = async (req, res) => {
    const authUser = await requireAuthenticatedUser(req, res);
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
    const regenerated = generateWeeklyPlan(userId, source, weekStart);
    const replacement = regenerated.days.find((day) => day.date === date);
    if (!replacement) {
        return res.status(500).json({ ok: false, error: "Failed to regenerate day" });
    }
    const merged = mergePlanDay(basePlan, date, {
        occasion: targetDay.occasion,
        itemIds: replacement.itemIds,
        notes: targetDay.notes || "",
        locked: targetDay.locked || false,
    });
    await savePlan(merged);
    return res.json({ ok: true, plan: merged });
};
