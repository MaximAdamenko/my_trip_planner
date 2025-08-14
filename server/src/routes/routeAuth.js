// server/src/routes/routeAuth.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXP = process.env.JWT_EXPIRATION || "5h";

function signUser(user) {
  const payload = { id: user._id, email: user.email, name: user.name || "" };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXP });
  return { token, user: payload };
}

/* ---------- POST /api/auth/register ---------- */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "email & password required" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ ok: false, error: "User already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: (name || "").trim(),
      email: email.toLowerCase(),
      password: hash,
    });

    const { token, user: payload } = signUser(user);
    return res.json({ ok: true, token, user: payload });
  } catch (e) {
    console.error("register error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ---------- POST /api/auth/login ---------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "email & password required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password || "");
    if (!match) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const { token, user: payload } = signUser(user);
    return res.json({ ok: true, token, user: payload });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ---------- GET /api/auth/me (optional) ---------- */
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "No token" });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id email name");
    if (!user) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, user });
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
});

export default router;
