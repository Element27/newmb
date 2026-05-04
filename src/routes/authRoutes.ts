import { Router } from "express";
import {
  authCallback,
  login,
  logout,
  sendMagicLink,
  session,
  signup,
} from "../controllers/authController";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/magic-link", sendMagicLink);
router.post("/logout", logout);
router.get("/session", session);
router.get("/callback", authCallback);

export default router;
