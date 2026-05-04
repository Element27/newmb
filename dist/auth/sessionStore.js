"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_MAX_AGE_SECONDS = exports.SESSION_COOKIE_NAME = void 0;
exports.createSession = createSession;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
exports.rotateSession = rotateSession;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
function getStoreFile() {
    return path_1.default.join(__dirname, "../../data/sessions.json");
}
function readStore() {
    const file = getStoreFile();
    if (!fs_1.default.existsSync(file))
        return { sessions: [] };
    try {
        return JSON.parse(fs_1.default.readFileSync(file, "utf-8"));
    }
    catch {
        return { sessions: [] };
    }
}
function writeStore(store) {
    const file = getStoreFile();
    const dir = path_1.default.dirname(file);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(file, JSON.stringify(store, null, 2));
}
function cleanupExpired(store) {
    const now = Date.now();
    store.sessions = store.sessions.filter((session) => session.expiresAt > now);
}
function createSession(user) {
    const store = readStore();
    cleanupExpired(store);
    const token = crypto_1.default.randomUUID();
    const now = Date.now();
    const record = {
        token,
        user,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
    };
    store.sessions.push(record);
    writeStore(store);
    return record;
}
function getSession(token) {
    const store = readStore();
    cleanupExpired(store);
    const record = store.sessions.find((session) => session.token === token) || null;
    writeStore(store);
    return record;
}
function deleteSession(token) {
    const store = readStore();
    const before = store.sessions.length;
    store.sessions = store.sessions.filter((session) => session.token !== token);
    if (store.sessions.length !== before)
        writeStore(store);
}
function rotateSession(token) {
    const existing = getSession(token);
    if (!existing)
        return null;
    deleteSession(token);
    return createSession(existing.user);
}
exports.SESSION_COOKIE_NAME = "mura_sid";
exports.SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
