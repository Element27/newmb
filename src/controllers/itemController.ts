import { Request, Response } from "express";
import { getSupabaseServer } from "../config/supabase";
import { requireAuthenticatedUser } from "../auth/httpSession";

export const getItems = async (req: Request, res: Response) => {
    const supabase = getSupabaseServer();
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;
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

        const items = (data || []).map((i: any) => ({
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

export const deleteItem = async (req: Request, res: Response) => {
    const supabase = getSupabaseServer();
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;
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
        if (error) return res.status(500).json({ ok: false, error: error.message });

        return res.json({ ok: true });
    }

    res.status(500).json({ ok: false, error: "Supabase not configured" });
};
