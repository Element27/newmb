import { Router } from "express";
import { recommend, getDailySuggestion } from "../controllers/recommendController.js";

const router = Router();

router.post("/", recommend);
router.get("/daily", getDailySuggestion);

export default router;

