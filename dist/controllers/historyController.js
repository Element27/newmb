import { getSupabaseServer } from "../config/supabase.js";
import { requireAuthenticatedUser } from "../auth/httpSession.js";
/**
 * POST /api/history
 * Log that a user wore a specific item today (manual) or that items were suggested (auto).
 * Body: { itemIds: string[], occasion?: string, wornAt?: string, type?: "worn" | "suggested" }
 */
export const logOutfitHistory = async (req, res) => {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const { itemIds, occasion, wornAt, type = "worn" } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ ok: false, error: "itemIds array is required" });
    }
    const supabase = getSupabaseServer();
    if (!supabase) {
        return res.status(503).json({ ok: false, error: "Database not configured" });
    }
    const date = wornAt || new Date().toISOString().slice(0, 10);
    const rows = itemIds.map((itemId) => ({
        user_id: userId,
        item_id: itemId,
        worn_at: date,
        occasion: occasion ?? null,
        type,
    }));
    const { error } = await supabase.from("outfit_history").insert(rows);
    if (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
    return res.json({ ok: true, logged: rows.length });
};
/**
 * GET /api/history
 * Returns worn counts and last worn date for all of the user's items.
 */
export const getOutfitHistory = async (req, res) => {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const supabase = getSupabaseServer();
    if (!supabase) {
        return res.json({ ok: true, history: [] });
    }
    const { data, error } = await supabase
        .from("outfit_history")
        .select("item_id, worn_at, type")
        .eq("user_id", userId)
        .order("worn_at", { ascending: false });
    if (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
    // Aggregate per item_id: count worn entries, find latest date
    const map = new Map();
    for (const row of data || []) {
        const existing = map.get(row.item_id) ?? { wornCount: 0, suggestedCount: 0, lastWornAt: null };
        if (row.type === "suggested") {
            existing.suggestedCount += 1;
        }
        else {
            existing.wornCount += 1;
            if (!existing.lastWornAt || row.worn_at > existing.lastWornAt) {
                existing.lastWornAt = row.worn_at;
            }
        }
        map.set(row.item_id, existing);
    }
    const history = Array.from(map.entries()).map(([itemId, stats]) => ({
        itemId,
        ...stats,
    }));
    return res.json({ ok: true, history });
};
