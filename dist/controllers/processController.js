"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImage = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const classifier_1 = require("../utils/classifier");
const httpSession_1 = require("../auth/httpSession");
function inferCategoryFromName(name) {
    const lower = String(name || "").toLowerCase();
    if (/(shirt|tee|top|blouse|sweater|hoodie)/.test(lower))
        return "top";
    if (/(jeans|pant|trouser|skirt|short)/.test(lower))
        return "bottom";
    if (/(shoe|sneaker|boot|loafer|heel|sandal|flip\s?flop)/.test(lower))
        return "shoes";
    if (/(jacket|coat|cardigan|blazer)/.test(lower))
        return "outer";
    if (/(dress)/.test(lower))
        return "dress";
    if (/(hat|belt|bag|scarf|watch)/.test(lower))
        return "accessory";
    return null;
}
const processImage = async (req, res) => {
    try {
        const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
        if (!authUser)
            return;
        const { id, name, originalPath } = req.body;
        if (!id || !originalPath) {
            return res.status(400).json({ ok: false, error: "Missing id or originalPath" });
        }
        const localFilePath = path_1.default.join(__dirname, "../../public", originalPath.replace(/^\//, ""));
        if (!fs_1.default.existsSync(localFilePath)) {
            return res.status(404).json({
                ok: false,
                error: "Original file not found",
                needClientProcessing: true,
            });
        }
        // Attempt AI classification
        const aiResult = await (0, classifier_1.classifyImage)(localFilePath);
        let category = aiResult.category;
        let label = aiResult.label;
        let confidence = aiResult.confidence;
        // Fallback to name inference if AI is not confident
        if (!category || confidence < 0.5) {
            const fallbackCat = inferCategoryFromName(name);
            if (fallbackCat) {
                category = fallbackCat;
                label = label || name.split(".")[0];
                confidence = Math.max(confidence, 0.4);
            }
        }
        res.json({
            ok: true,
            needClientProcessing: false,
            id,
            name,
            originalPath,
            processedDataUrl: null,
            label: label || name.split(".")[0],
            category: category || "top",
            confidence,
        });
    }
    catch (error) {
        res.status(500).json({
            ok: false,
            error: error.message,
            needClientProcessing: true,
        });
    }
};
exports.processImage = processImage;
