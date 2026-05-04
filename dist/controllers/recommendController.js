"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommend = void 0;
const openai_1 = __importDefault(require("openai"));
const supabase_1 = require("../config/supabase");
const recommend_1 = require("../utils/recommend");
const httpSession_1 = require("../auth/httpSession");
const recommend = async (req, res) => {
    const { occasion, prompt } = req.body;
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    let items = [];
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase && userId) {
        const { data, error } = await supabase
            .from("items")
            .select("id,name,category,color_hex,original_url,processed_url,label,confidence")
            .eq("user_id", userId);
        if (data && !error) {
            items = data.map((i) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                colorHex: i.color_hex,
                originalPath: i.original_url,
                processedPath: i.processed_url,
            }));
        }
    }
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (apiKey && items.length > 0) {
        try {
            const openai = new openai_1.default({ apiKey });
            const sys = "You are a wardrobe stylist. If a user prompt is provided, tailor the outfit to that prompt while ensuring pieces coordinate by color and category. Prefer neutral colors for work, comfortable for travel, and expressive for casual. Return JSON with an `ids` array of item ids.";
            const user = JSON.stringify({ occasion, prompt, items });
            const resp = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: sys },
                    { role: "user", content: user },
                ],
            });
            const content = resp.choices?.[0]?.message?.content || "{}";
            const parsed = JSON.parse(content);
            const ids = Array.isArray(parsed?.ids) ? parsed.ids : [];
            if (ids.length) {
                const byId = new Map(items.map((i) => [i.id, i]));
                const rec = ids.map((id) => byId.get(id)).filter(Boolean);
                if (rec.length)
                    return res.json({ items: rec });
            }
        }
        catch (e) {
            console.error("OpenAI error", e);
        }
    }
    const rec = (0, recommend_1.recommendOutfit)(items, occasion);
    res.json({ items: rec });
};
exports.recommend = recommend;
