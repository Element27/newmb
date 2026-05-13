import { Router } from "express";
import { processImage } from "../controllers/processController.js";
const router = Router();
router.post("/", processImage);
export default router;
