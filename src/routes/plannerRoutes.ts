import { Router } from "express";
import {
  generateWeeklyPlanHandler,
  getWeeklyPlan,
  regenerateWeeklyPlanDay,
  updateWeeklyPlanDay,
} from "../controllers/plannerController";

const router = Router();

router.get("/", getWeeklyPlan);
router.post("/generate", generateWeeklyPlanHandler);
router.patch("/day", updateWeeklyPlanDay);
router.post("/day/regenerate", regenerateWeeklyPlanDay);

export default router;
