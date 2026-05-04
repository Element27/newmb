import { Router } from "express";
import { getItems, deleteItem } from "../controllers/itemController";

const router = Router();

router.get("/", getItems);
router.delete("/:id", deleteItem);

export default router;
