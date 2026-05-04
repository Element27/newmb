"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteItem = exports.getItems = void 0;
const supabase_1 = require("../config/supabase");
const httpSession_1 = require("../auth/httpSession");
const getItems = async (req, res) => {
    const supabase = (0, supabase_1.getSupabaseServer)();
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    if (!userId) {
        return res.json({ items: [] });
    }
    if (supabase) {
        const { data, error } = await supabase
            .from("items")
            .select("id,name,category,color_hex,original_url,processed_url,label,confidence")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) {
            return res.status(500).json({ ok: false, error: error.message });
        }
        const items = (data || []).map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            colorHex: i.color_hex,
            originalPath: i.original_url,
            processedPath: i.processed_url,
            label: i.label ?? null,
            confidence: i.confidence ?? null,
        }));
        return res.json({ items });
    }
    // Fallback to local JSON
    // ... (keeping implementation parity if possible)
    res.json({ items: [] });
};
exports.getItems = getItems;
const deleteItem = async (req, res) => {
    const supabase = (0, supabase_1.getSupabaseServer)();
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ ok: false, error: "Missing id" });
    }
    if (supabase) {
        const { error } = await supabase
            .from("items")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);
        if (error)
            return res.status(500).json({ ok: false, error: error.message });
        return res.json({ ok: true });
    }
    res.status(500).json({ ok: false, error: "Supabase not configured" });
};
exports.deleteItem = deleteItem;
