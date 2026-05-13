import { Router } from "express";
import { saveItem } from "../controllers/saveController.js";

const router = Router();

router.post("/", saveItem);

export default router;

