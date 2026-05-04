import { Request, Response } from "express";
import OpenAI from "openai";
import { getSupabaseServer } from "../config/supabase";
import { recommendOutfit, WardrobeItem } from "../utils/recommend";
import { requireAuthenticatedUser } from "../auth/httpSession";

type UserProfile = {
    primaryStyle?: string | null;
    stylePreferences?: string[];
    size?: string | null;
};

function buildProfileContext(profile?: UserProfile): string {
    if (!profile) return "";
    const parts: string[] = [];
    if (profile.primaryStyle) {
        parts.push(`- Preferred style expression: ${profile.primaryStyle}`);
    }
    if (profile.stylePreferences && profile.stylePreferences.length > 0) {
        parts.push(`- Style preferences: ${profile.stylePreferences.join(", ")}`);
    }
    if (profile.size) {
        parts.push(`- Clothing size: ${profile.size}`);
    }
    if (parts.length === 0) return "";
    return `\n\nUser Profile Context:\n${parts.join("\n")}`;
}

export const recommend = async (req: Request, res: Response) => {
    const { occasion, prompt, userProfile } = req.body;
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;
    const userId = authUser.id;

    let items: WardrobeItem[] = [];
    const supabase = getSupabaseServer();

    if (supabase && userId) {
        const { data, error } = await supabase
            .from("items")
            .select("id,name,category,color_hex,original_url,processed_url,label,confidence")
            .eq("user_id", userId);

        if (data && !error) {
            items = data.map((i: any) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                colorHex: i.color_hex,
                originalPath: i.original_url,
                processedPath: i.processed_url,
            }));
        }
    }

    const profileContext = buildProfileContext(userProfile as UserProfile);
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (apiKey && items.length > 0) {
        try {
            const openai = new OpenAI({ apiKey });
            const sys = `You are a personal wardrobe stylist. If a user prompt is provided, tailor the outfit to that prompt while ensuring pieces coordinate by color and category. Prefer neutral colors for work, comfortable for travel, and expressive for casual. Return JSON with an \`ids\` array of item ids.${profileContext}`;
            const user = JSON.stringify({ occasion, prompt, items });
            const resp = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: sys },
                    { role: "user", content: user },
                ],
                response_format: { type: "json_object" },
            });
            const content = resp.choices?.[0]?.message?.content || "{}";
            const parsed = JSON.parse(content);
            const ids: string[] = Array.isArray(parsed?.ids) ? parsed.ids : [];
            if (ids.length) {
                const byId = new Map(items.map((i) => [i.id, i]));
                const rec = ids.map((id) => byId.get(id)).filter(Boolean) as WardrobeItem[];
                if (rec.length) return res.json({ items: rec });
            }
        } catch (e) {
            console.error("OpenAI error", e);
        }
    }

    const rec = recommendOutfit(items, occasion);
    res.json({ items: rec });
};

