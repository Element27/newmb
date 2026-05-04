"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveOnboardingProfile = exports.getOnboardingProfile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_1 = require("../config/supabase");
const httpSession_1 = require("../auth/httpSession");
const DEFAULT_PROFILE = {
    name: null,
    primaryStyle: null,
    size: null,
    stylePreferences: [],
    onboardingCompleted: false,
    uploadedFirstItem: false,
};
function getFallbackFile() {
    return path_1.default.join(__dirname, "../../data/onboarding.json");
}
function readFallbackProfiles() {
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
function writeFallbackProfiles(profiles) {
    const file = getFallbackFile();
    const dir = path_1.default.dirname(file);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(file, JSON.stringify(profiles, null, 2));
}
const getOnboardingProfile = async (req, res) => {
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const email = authUser.email || null;
    if (!userId) {
        return res.status(400).json({ ok: false, error: "Missing userId" });
    }
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase) {
        const { data, error } = await supabase
            .from("profiles")
            .select("user_id,email,name,primary_style,size,style_preferences,onboarding_completed,uploaded_first_item,created_at,updated_at")
            .eq("user_id", userId)
            .maybeSingle();
        if (!error && data) {
            return res.json({
                ok: true,
                profile: {
                    userId: data.user_id,
                    email: data.email,
                    name: data.name,
                    primaryStyle: data.primary_style,
                    size: data.size,
                    stylePreferences: data.style_preferences || [],
                    onboardingCompleted: data.onboarding_completed ?? false,
                    uploadedFirstItem: data.uploaded_first_item ?? false,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                },
            });
        }
    }
    const fallback = readFallbackProfiles().find((profile) => profile.userId === userId);
    return res.json({
        ok: true,
        profile: fallback || { userId, email, ...DEFAULT_PROFILE },
    });
};
exports.getOnboardingProfile = getOnboardingProfile;
const saveOnboardingProfile = async (req, res) => {
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const payload = req.body;
    const userId = authUser.id;
    if (!userId) {
        return res.status(400).json({ ok: false, error: "Missing userId" });
    }
    const profile = {
        userId,
        email: authUser.email ?? payload.email ?? null,
        name: payload.name ?? null,
        primaryStyle: payload.primaryStyle ?? null,
        size: payload.size ?? null,
        stylePreferences: Array.isArray(payload.stylePreferences)
            ? payload.stylePreferences
            : [],
        onboardingCompleted: Boolean(payload.onboardingCompleted),
        uploadedFirstItem: Boolean(payload.uploadedFirstItem),
        updatedAt: new Date().toISOString(),
    };
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase) {
        const upsertPayload = {
            user_id: profile.userId,
            email: profile.email,
            name: profile.name,
            primary_style: profile.primaryStyle,
            size: profile.size,
            style_preferences: profile.stylePreferences,
            onboarding_completed: profile.onboardingCompleted,
            uploaded_first_item: profile.uploadedFirstItem,
            updated_at: profile.updatedAt,
        };
        const { error } = await supabase
            .from("profiles")
            .upsert(upsertPayload, { onConflict: "user_id" });
        if (!error) {
            return res.json({ ok: true, profile });
        }
    }
    const profiles = readFallbackProfiles();
    const existing = profiles.find((item) => item.userId === profile.userId);
    if (existing) {
        Object.assign(existing, profile);
    }
    else {
        profiles.push({
            ...profile,
            createdAt: new Date().toISOString(),
        });
    }
    writeFallbackProfiles(profiles);
    return res.json({ ok: true, profile });
};
exports.saveOnboardingProfile = saveOnboardingProfile;
