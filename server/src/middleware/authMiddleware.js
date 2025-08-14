// server/src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

/**
 * Extracts a Bearer token from the Authorization header.
 */
function getToken(req) {
  const hdr = req.headers?.authorization || "";
  return hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
}

/**
 * Require a valid JWT. Attaches req.user = { id, email, name } on success.
 */
export function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];

  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // attach user identity to request
    req.user = {
      id: payload.sub || payload.id || payload.userId,
      email: payload.email,
      name: payload.name
    };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

/**
 * Optional auth: if a valid token is present, sets req.user; otherwise continues.
 */
export function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      req.user = { id: payload.id, email: payload.email, name: payload.name };
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}
