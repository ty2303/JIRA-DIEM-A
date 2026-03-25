import express from "express";
import { ok } from "../lib/apiResponse.js";
import { requireAuth } from "../middleware/auth.js";

export const uploadRouter = express.Router();

uploadRouter.post("/image", requireAuth, (_req, res) => {
  const imageUrl = `https://picsum.photos/seed/${Date.now()}/800/800`;
  res.json(ok(imageUrl, "Upload anh thanh cong"));
});
