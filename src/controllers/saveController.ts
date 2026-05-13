import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getSupabaseServer, STORAGE_BUCKET } from "../config/supabase.js";
import { requireAuthenticatedUser } from "../auth/httpSession.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type SaveItemPayload = {
    id: string;
    name: string;
    category: string;
    colorHex: string;
    originalPath: string;
    processedDataUrl?: string | null;
    label?: string | null;
    confidence?: number | null;
};

export async function persistWardrobeItem(userId: string, payload: SaveItemPayload) {
    const { id, name, category, colorHex, originalPath } = payload;
    const supabase = getSupabaseServer();

    if (!supabase) {
        throw new Error("Supabase not configured");
    }

    const localFilePath = path.join(
        __dirname,
        "../../public",
        originalPath.replace(/^\//, "")
    );

    let buffer: Buffer | null = null;
    const ext = path.extname(localFilePath) || ".png";
    let contentType = "image/png";

    if (payload.processedDataUrl && payload.processedDataUrl.startsWith("data:")) {
        const [hdr, b64] = payload.processedDataUrl.split(",");
        const mt = hdr.substring(5, hdr.indexOf(";"));
        contentType = mt || "image/png";
        buffer = Buffer.from(b64, "base64");
    } else if (fs.existsSync(localFilePath)) {
        buffer = fs.readFileSync(localFilePath);
    }

    const key = `processed/${id}${ext}`;
    if (buffer) {
        const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(key, buffer, {
                contentType,
                upsert: true,
            });
        if (error) {
            throw new Error(error.message);
        }
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key);
    const processedPath = data.publicUrl;

    const insertPayload = {
        id,
        name,
        category,
        color_hex: colorHex,
        original_url: originalPath,
        processed_url: processedPath,
        user_id: userId,
        label: payload.label ?? null,
        confidence: payload.confidence ?? null,
    };

    const { error: dbErr } = await supabase.from("items").insert(insertPayload);
    if (dbErr) {
        throw new Error(dbErr.message);
    }

    // Clean up local original upload
    if (originalPath?.startsWith("/uploads/")) {
        try {
            const localFile = path.join(__dirname, "../../public", originalPath.replace(/^\//, ""));
            if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
        } catch { }
    }

    return {
        id,
        name,
        category,
        colorHex,
        originalPath,
        processedPath,
        user_id: userId,
        label: payload.label || null,
        confidence: payload.confidence ?? null,
    };
}

export const saveItem = async (req: Request, res: Response) => {
    const payload = req.body as SaveItemPayload;
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;

    try {
        const item = await persistWardrobeItem(authUser.id, payload);
        return res.json({ ok: true, item });
    } catch (error: any) {
        return res.status(500).json({ ok: false, error: error.message });
    }
};

