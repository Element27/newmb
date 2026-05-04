"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recommendController_1 = require("../controllers/recommendController");
const router = (0, express_1.Router)();
router.post("/", recommendController_1.recommend);
exports.default = router;
