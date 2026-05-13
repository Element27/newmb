import { Router } from "express";
import multer from "multer";
import { uploadFile, deleteFile } from "../controllers/uploadController.js";

const router = Router();
const upload = multer({ dest: "temp/" }); // Temporary storage for multer

router.post("/", upload.single("file"), uploadFile);
router.delete("/", deleteFile);

export default router;

