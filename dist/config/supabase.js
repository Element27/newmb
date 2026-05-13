import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export function getSupabaseServer() {
    if (!url || !serviceKey)
        return null;
    return createClient(url, serviceKey, { auth: { persistSession: false } });
}
export function getSupabaseAnon() {
    if (!url || !anonKey)
        return null;
    return createClient(url, anonKey);
}
export const STORAGE_BUCKET = "wardrobe";
