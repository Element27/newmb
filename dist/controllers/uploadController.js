"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.uploadFile = void 0;
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const httpSession_1 = require("../auth/httpSession");
const uploadFile = async (req, res) => {
    try {
        const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
        if (!authUser)
            return;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ ok: false, error: "No file" });
        }
        const id = (0, uuid_1.v4)();
        const ext = path_1.default.extname(file.originalname) || ".png";
        const filename = `${id}${ext}`;
        // The file is already saved by multer in the temp dir or memory.
        // We move it to public/uploads
        const uploadsDir = path_1.default.join(__dirname, "../../public/uploads");
        if (!fs_1.default.existsSync(uploadsDir))
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        const filepath = path_1.default.join(uploadsDir, filename);
        fs_1.default.renameSync(file.path, filepath);
        const originalPath = `/uploads/${filename}`;
        res.json({ ok: true, id, originalPath });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
};
exports.uploadFile = uploadFile;
const deleteFile = async (req, res) => {
    try {
        const authUser = await (0, httpSession_1.requireAuthenticatedUser)(req, res);
        if (!authUser)
            return;
        let originalPath = req.body.originalPath || req.query.path;
        if (!originalPath || !originalPath.startsWith("/uploads/")) {
            return res.status(400).json({ ok: false, error: "Invalid path" });
        }
        const localFile = path_1.default.join(__dirname, "../../public", originalPath.replace(/^\//, ""));
        if (fs_1.default.existsSync(localFile))
            fs_1.default.unlinkSync(localFile);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
};
exports.deleteFile = deleteFile;
