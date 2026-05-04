import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getSupabaseServer } from "../config/supabase";
import { requireAuthenticatedUser } from "../auth/httpSession";

type OnboardingProfile = {
  userId: string;
  email?: string | null;
  name?: string | null;
  primaryStyle?: string | null;
  size?: string | null;
  stylePreferences?: string[];
  onboardingCompleted?: boolean;
  uploadedFirstItem?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_PROFILE = {
  name: null,
  primaryStyle: null,
  size: null,
  stylePreferences: [] as string[],
  onboardingCompleted: false,
  uploadedFirstItem: false,
};

function getFallbackFile() {
  return path.join(__dirname, "../../data/onboarding.json");
}

function readFallbackProfiles(): OnboardingProfile[] {
  const file = getFallbackFile();
  if (!fs.existsSync(file)) return [];

  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as OnboardingProfile[];
  } catch {
    return [];
  }
}

function writeFallbackProfiles(profiles: OnboardingProfile[]) {
  const file = getFallbackFile();
  const dir = path.dirname(file);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(file, JSON.stringify(profiles, null, 2));
}

export const getOnboardingProfile = async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;
  const userId = authUser.id;
  const email = authUser.email || null;

  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }

  const supabase = getSupabaseServer();

  if (supabase) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id,email,name,primary_style,size,style_preferences,onboarding_completed,uploaded_first_item,created_at,updated_at"
      )
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

export const saveOnboardingProfile = async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;
  const payload = req.body as OnboardingProfile;
  const userId = authUser.id;

  if (!userId) {
    return res.status(400).json({ ok: false, error: "Missing userId" });
  }

  const profile: OnboardingProfile = {
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

  const supabase = getSupabaseServer();

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
  } else {
    profiles.push({
      ...profile,
      createdAt: new Date().toISOString(),
    });
  }

  writeFallbackProfiles(profiles);
  return res.json({ ok: true, profile });
};
