import crypto from "crypto";
import fs from "fs";
import path from "path";

type SessionUser = {
  id: string;
  email?: string | null;
};

type SessionRecord = {
  token: string;
  user: SessionUser;
  createdAt: number;
  expiresAt: number;
};

type SessionStoreFile = {
  sessions: SessionRecord[];
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getStoreFile() {
  return path.join(__dirname, "../../data/sessions.json");
}

function readStore(): SessionStoreFile {
  const file = getStoreFile();
  if (!fs.existsSync(file)) return { sessions: [] };
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as SessionStoreFile;
  } catch {
    return { sessions: [] };
  }
}

function writeStore(store: SessionStoreFile) {
  const file = getStoreFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

function cleanupExpired(store: SessionStoreFile) {
  const now = Date.now();
  store.sessions = store.sessions.filter((session) => session.expiresAt > now);
}

export function createSession(user: SessionUser) {
  const store = readStore();
  cleanupExpired(store);

  const token = crypto.randomUUID();
  const now = Date.now();
  const record: SessionRecord = {
    token,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  store.sessions.push(record);
  writeStore(store);
  return record;
}

export function getSession(token: string) {
  const store = readStore();
  cleanupExpired(store);
  const record = store.sessions.find((session) => session.token === token) || null;
  writeStore(store);
  return record;
}

export function deleteSession(token: string) {
  const store = readStore();
  const before = store.sessions.length;
  store.sessions = store.sessions.filter((session) => session.token !== token);
  if (store.sessions.length !== before) writeStore(store);
}

export function rotateSession(token: string) {
  const existing = getSession(token);
  if (!existing) return null;
  deleteSession(token);
  return createSession(existing.user);
}

export const SESSION_COOKIE_NAME = "mura_sid";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

