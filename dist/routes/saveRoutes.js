"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const saveController_1 = require("../controllers/saveController");
const router = (0, express_1.Router)();
router.post("/", saveController_1.saveItem);
exports.default = router;
