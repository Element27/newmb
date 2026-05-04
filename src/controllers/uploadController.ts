import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { requireAuthenticatedUser } from "../auth/httpSession";
import { classifyImage, extractAverageColorHex } from "../utils/classifier";
import { persistWardrobeItem } from "./saveController";

function inferCategoryFromName(
    name: string
): "top" | "bottom" | "shoes" | "outer" | "dress" | "accessory" | null {
    const lower = String(name || "").toLowerCase();
    if (/(shirt|tee|top|blouse|sweater|hoodie)/.test(lower)) return "top";
    if (/(jeans|pant|trouser|skirt|short)/.test(lower)) return "bottom";
    if (/(shoe|sneaker|boot|loafer|heel|sandal|flip\s?flop)/.test(lower))
        return "shoes";
    if (/(jacket|coat|cardigan|blazer)/.test(lower)) return "outer";
    if (/(dress)/.test(lower)) return "dress";
    if (/(hat|belt|bag|scarf|watch)/.test(lower)) return "accessory";
    return null;
}

export const uploadFile = async (req: Request, res: Response) => {
    try {
        const authUser = await requireAuthenticatedUser(req, res);
        if (!authUser) return;

        const file = req.file;
        if (!file) {
            return res.status(400).json({ ok: false, error: "No file" });
        }

        const id = uuidv4();
        const ext = path.extname(file.originalname) || ".png";
        const filename = `${id}${ext}`;

        // The file is already saved by multer in the temp dir or memory.
        // We move it to public/uploads
        const uploadsDir = path.join(__dirname, "../../public/uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const filepath = path.join(uploadsDir, filename);
        fs.renameSync(file.path, filepath);

        const originalPath = `/uploads/${filename}`;
        const manualCategory = typeof req.body.category === "string" ? req.body.category : undefined;
        const aiResult = await classifyImage(filepath, manualCategory);
        const fallbackCategory = inferCategoryFromName(file.originalname);
        const category =
            aiResult.category ||
            fallbackCategory ||
            "top";
        const label =
            aiResult.label && aiResult.label !== "unknown"
                ? aiResult.label
                : path.parse(file.originalname).name;
        const confidence = aiResult.confidence;
        const colorHex = await extractAverageColorHex(filepath);

        const item = await persistWardrobeItem(authUser.id, {
            id,
            name: file.originalname,
            category,
            colorHex,
            originalPath,
            label,
            confidence,
            processedDataUrl: null,
        });

        const responsePayload = { ok: true, id, originalPath, item };
        console.log("----- Final Upload Response -----");
        console.log(JSON.stringify(responsePayload, null, 2));

        res.json(responsePayload);
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error.message });
    }
};

export const deleteFile = async (req: Request, res: Response) => {
    try {
        const authUser = await requireAuthenticatedUser(req, res);
        if (!authUser) return;

        let originalPath = req.body.originalPath || req.query.path;

        if (!originalPath || !originalPath.startsWith("/uploads/")) {
            return res.status(400).json({ ok: false, error: "Invalid path" });
        }

        const localFile = path.join(__dirname, "../../public", originalPath.replace(/^\//, ""));
        if (fs.existsSync(localFile)) fs.unlinkSync(localFile);

        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error.message });
    }
};
