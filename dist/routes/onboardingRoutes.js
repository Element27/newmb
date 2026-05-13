import { Router } from "express";
import { getOnboardingProfile, saveOnboardingProfile, } from "../controllers/onboardingController.js";
const router = Router();
router.get("/", getOnboardingProfile);
router.post("/", saveOnboardingProfile);
export default router;
