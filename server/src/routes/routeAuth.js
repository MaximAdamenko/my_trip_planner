import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/authMiddleware.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXP = process.env.JWT_EXPIRATION || "5h";

/* utility: create JWT with the id field */
function signToken(userId) {
  return jwt.sign({ id: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXP });
}

/* ---------- POST /api/auth/register ---------- */
/* body: { name?, email, password } */
router.post("/register", async (req, res) => {
  try {
    let { name = "", email = "", password = "" } = req.body || {};
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });

    const token = signToken(user._id);
    res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, name: user.name || "" }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});

/* ---------- POST /api/auth/login ---------- */
/* body: { email, password } */
router.post("/login", async (req, res) => {
  try {
    let { email = "", password = "" } = req.body || {};
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ ok: false, error: "Invalid credentials" });
    }

    // support either user.password or user.passwordHash
    const hashed = user.passwordHash || user.password;
    const match = await bcrypt.compare(password, hashed);
    if (!match) {
      return res.status(400).json({ ok: false, error: "Invalid credentials" });
    }

    const token = signToken(user._id);
    res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, name: user.name || "" }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});

/* ---------- GET /api/auth/me (optional) ---------- */
/* verify token and return user basics */
router.get("/me", auth, async (req, res) => {
  const u = await User.findById(req.user.id).select("_id email name").lean();
  if (!u) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, user: { id: u._id, email: u.email, name: u.name || "" } });
});

export default router;
