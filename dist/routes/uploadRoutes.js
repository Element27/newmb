"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uploadController_1 = require("../controllers/uploadController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: "temp/" }); // Temporary storage for multer
router.post("/", upload.single("file"), uploadController_1.uploadFile);
router.delete("/", uploadController_1.deleteFile);
exports.default = router;
