import { Router } from "express";
import { processImage } from "../controllers/processController";

const router = Router();

router.post("/", processImage);

export default router;
