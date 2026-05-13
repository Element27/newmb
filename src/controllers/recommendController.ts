import { Request, Response } from "express";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabaseServer } from "../config/supabase.js";
import { recommendOutfit, WardrobeItem } from "../utils/recommend.js";
import { requireAuthenticatedUser } from "../auth/httpSession.js";
import { fetchWeatherByCity } from "../utils/weather.js";

type UserProfile = {
    primaryStyle?: string | null;
    stylePreferences?: string[];
    size?: string | null;
};

const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";

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

    const systemPrompt = `You are a personal wardrobe stylist. If a user prompt is provided, tailor the outfit to that prompt while ensuring pieces coordinate by color and category. Prefer neutral colors for work, comfortable for travel, and expressive for casual. Return JSON with an \`ids\` array of item ids.${profileContext}`;
    const userMessage = JSON.stringify({ occasion, prompt, items });

    if (AI_PROVIDER === "openai" && items.length > 0) {
        const openaiApiKey = process.env.OPENAI_API_KEY || "";
        if (openaiApiKey) {
            try {
                const openai = new OpenAI({ apiKey: openaiApiKey });
                const resp = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage },
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
    }

    if (AI_PROVIDER === "gemini" && items.length > 0) {
        const geminiApiKey = process.env.GEMINI_API_KEY || "";
        if (geminiApiKey) {
            try {
                const genAI = new GoogleGenerativeAI(geminiApiKey);
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.0-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });
                const fullPrompt = `${systemPrompt}\n\nUser Request:\n${userMessage}`;
                const resp = await model.generateContent(fullPrompt);
                const content = resp.response.text();
                const parsed = JSON.parse(content || "{}");
                const ids: string[] = Array.isArray(parsed?.ids) ? parsed.ids : [];
                if (ids.length) {
                    const byId = new Map(items.map((i) => [i.id, i]));
                    const rec = ids.map((id) => byId.get(id)).filter(Boolean) as WardrobeItem[];
                    if (rec.length) return res.json({ items: rec });
                }
            } catch (e) {
                console.error("Gemini error", e);
            }
        }
    }

    const rec = recommendOutfit(items, occasion);
    res.json({ items: rec });
};

const WEATHER_CITY = process.env.WEATHER_CITY || "Lagos";

function getDayPhrase(): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = days[new Date().getDay()];
    const phrases: Record<string, string[]> = {
        Monday: ["fresh start", "new week"],
        Tuesday: ["midweek", "Tuesday"],
        Wednesday: ["hump day", "midweek"],
        Thursday: ["almost weekend", "Thursday"],
        Friday: ["Fri-yay", "end of week"],
        Saturday: ["weekend", "Saturday"],
        Sunday: ["rest day", "Sunday"],
    };
    const options = phrases[today] || [today.toLowerCase()];
    return options[Math.floor(Math.random() * options.length)];
}

function buildSuggestionMessage(
    weather: { temp: number; condition: string } | null,
    item: WardrobeItem | null,
    dayPhrase: string
): string {
    const conditions = weather?.condition.toLowerCase() || "";
    const temp = weather?.temp || 20;
    const itemName = item?.label || item?.name || "outfit";

    let message = "";

    if (conditions.includes("rain") || conditions.includes("drizzle")) {
        message = `It's a ${dayPhrase} with rain expected. A layered look with ${itemName} would keep you comfortable.`;
    } else if (temp >= 25) {
        message = `It's a warm ${dayPhrase}. Light and breathable looks like ${itemName} are perfect today.`;
    } else if (temp >= 15 && temp < 25) {
        message = `It's a pleasant ${dayPhrase}. A stylish combo featuring ${itemName} would look great.`;
    } else if (temp < 15) {
        message = `It's a cool ${dayPhrase}. Consider layering with ${itemName} for warmth and style.`;
    } else {
        message = `It's a ${dayPhrase}. You could rock the ${itemName} today.`;
    }

    return message;
}

export const getDailySuggestion = async (req: Request, res: Response) => {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;
    const userId = authUser.id;

    let items: WardrobeItem[] = [];
    const supabase = getSupabaseServer();

    if (supabase && userId) {
        const { data } = await supabase
            .from("items")
            .select("id,name,category,color_hex,original_url,processed_url,label,confidence")
            .eq("user_id", userId);

        if (data) {
            items = data.map((i: any) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                colorHex: i.color_hex,
                originalPath: i.original_url,
                processedPath: i.processed_url,
                label: i.label,
            }));
        }
    }

    const dayPhrase = getDayPhrase();
    let weather = null;

    try {
        const weatherData = await fetchWeatherByCity(WEATHER_CITY);
        if (weatherData) {
            weather = { temp: weatherData.temperature, condition: weatherData.condition };
        }
    } catch (e) {
        console.error("Weather fetch error:", e);
    }

    const occasion: "work" | "casual" | "travel" = dayPhrase.includes("weekend") || dayPhrase === "Sunday" ? "casual" : "work";
    const outfit = recommendOutfit(items, occasion);
    const featuredItem = outfit.find((i) => i.category === "top" || i.category === "outer" || i.category === "dress") || outfit[0];

    const message = buildSuggestionMessage(weather, featuredItem, dayPhrase);

    res.json({
        message,
        weather: weather ? { city: WEATHER_CITY, ...weather } : null,
        outfit: outfit.slice(0, 2),
    });
};


