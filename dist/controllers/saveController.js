"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveItem = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const supabase_1 = require("../config/supabase");
const httpSession_1 = require("../auth/httpSession");
const saveItem = async (req, res) => {
    const payload = req.body;
    const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
    if (!authUser)
        return;
    const userId = authUser.id;
    const { id, name, category, colorHex, originalPath } = payload;
    const supabase = (0, supabase_1.getSupabaseServer)();
    if (supabase) {
        const localFilePath = path_1.default.join(__dirname, "../../public", originalPath.replace(/^\//, ""));
        let buffer = null;
        let ext = path_1.default.extname(localFilePath) || ".png";
        let contentType = "image/png";
        if (payload.processedDataUrl && payload.processedDataUrl.startsWith("data:")) {
            const [hdr, b64] = payload.processedDataUrl.split(",");
            const mt = hdr.substring(5, hdr.indexOf(";"));
            contentType = mt || "image/png";
            buffer = Buffer.from(b64, "base64");
        }
        else if (fs_1.default.existsSync(localFilePath)) {
            buffer = fs_1.default.readFileSync(localFilePath);
        }
        const key = `processed/${id}${ext}`;
        if (buffer) {
            const { error } = await supabase.storage
                .from(supabase_1.STORAGE_BUCKET)
                .upload(key, buffer, {
                contentType,
                upsert: true,
            });
            if (error)
                return res.status(500).json({ ok: false, error: error.message });
        }
        const { data } = supabase.storage.from(supabase_1.STORAGE_BUCKET).getPublicUrl(key);
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
        if (dbErr)
            return res.status(500).json({ ok: false, error: dbErr.message });
        // Clean up local original upload
        if (originalPath?.startsWith("/uploads/")) {
            try {
                const localFile = path_1.default.join(__dirname, "../../public", originalPath.replace(/^\//, ""));
                if (fs_1.default.existsSync(localFile))
                    fs_1.default.unlinkSync(localFile);
            }
            catch { }
        }
        return res.json({
            ok: true,
            item: {
                id,
                name,
                category,
                colorHex,
                originalPath,
                processedPath,
                user_id: userId,
                label: payload.label || null,
                confidence: payload.confidence ?? null,
            },
        });
    }
    res.status(500).json({ ok: false, error: "Supabase not configured" });
};
exports.saveItem = saveItem;
