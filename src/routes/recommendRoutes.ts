import { Router } from "express";
import { recommend } from "../controllers/recommendController";

const router = Router();

router.post("/", recommend);

export default router;
