import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// ✅ Signup Route
router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: "Account Created ✅" });
  } catch (err) {
    res.json({ success: false, message: "Username already exists ❌" });
  }
});

// ✅ Login Route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) return res.json({ success: false, message: "Invalid Login ❌" });

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) return res.json({ success: false, message: "Wrong Password ❌" });

  return res.json({ success: true, message: "Login Successful ✅" });
});

export default router;
