"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_BUCKET = void 0;
exports.getSupabaseServer = getSupabaseServer;
exports.getSupabaseAnon = getSupabaseAnon;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
function getSupabaseServer() {
    if (!url || !serviceKey)
        return null;
    return (0, supabase_js_1.createClient)(url, serviceKey, { auth: { persistSession: false } });
}
function getSupabaseAnon() {
    if (!url || !anonKey)
        return null;
    return (0, supabase_js_1.createClient)(url, anonKey);
}
exports.STORAGE_BUCKET = "wardrobe";
