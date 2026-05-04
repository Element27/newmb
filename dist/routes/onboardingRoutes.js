"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const onboardingController_1 = require("../controllers/onboardingController");
const router = (0, express_1.Router)();
router.get("/", onboardingController_1.getOnboardingProfile);
router.post("/", onboardingController_1.saveOnboardingProfile);
exports.default = router;
