import { Router } from "express";
import { saveItem } from "../controllers/saveController";

const router = Router();

router.post("/", saveItem);

export default router;
