import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
    if (!token) return res.status(401).json({ ok: false, error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // accept multiple possible keys from older/newer payloads
    const userId =
      decoded?.id ||
      decoded?._id ||
      decoded?.sub ||
      decoded?.userId ||
      decoded?.user?.id;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Bad token" });
    }
    req.user = { id: String(userId) };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
