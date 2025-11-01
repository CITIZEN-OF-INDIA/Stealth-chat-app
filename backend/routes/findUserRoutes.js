import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.get("/find-user/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });

    if (user) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error("Error in /find-user:", err);
    return res.status(500).json({ exists: false });
  }
});

export default router;
