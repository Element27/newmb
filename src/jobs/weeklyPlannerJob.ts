import fs from "fs";
import path from "path";
import { getSupabaseServer } from "../config/supabase";
import { generatePlanForUser } from "../controllers/plannerController";
import { getNextMonday, toISODate } from "../utils/weeklyPlanner";

type JobState = {
  lastRunSaturday?: string;
};

function getStateFile() {
  return path.join(__dirname, "../../data/weeklyPlannerJobState.json");
}

function readState(): JobState {
  const file = getStateFile();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as JobState;
  } catch {
    return {};
  }
}

function writeState(state: JobState) {
  const file = getStateFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

async function getEligibleUserIds() {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("onboarding_completed", true);

  if (error || !data) return [];
  return data.map((row: any) => String(row.user_id)).filter(Boolean);
}

export async function runWeeklyPlannerJob(force = false) {
  const now = new Date();
  const isSaturday = now.getDay() === 6;
  if (!force && !isSaturday) return;

  const todayISO = toISODate(now);
  const state = readState();
  if (!force && state.lastRunSaturday === todayISO) return;

  const userIds = await getEligibleUserIds();
  if (userIds.length === 0) {
    if (isSaturday) {
      writeState({ lastRunSaturday: todayISO });
    }
    return;
  }

  const weekStart = toISODate(getNextMonday(now));
  await Promise.all(userIds.map((userId) => generatePlanForUser(userId, weekStart)));

  if (isSaturday || force) {
    writeState({ lastRunSaturday: todayISO });
  }
}

export function startWeeklyPlannerJob() {
  void runWeeklyPlannerJob(false);

  const everyHourMs = 60 * 60 * 1000;
  setInterval(() => {
    void runWeeklyPlannerJob(false);
  }, everyHourMs);
}

