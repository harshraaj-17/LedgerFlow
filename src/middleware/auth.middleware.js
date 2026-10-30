const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const userModel = require("../models/user.model");
const tokenBlacklistModel = require("../models/blackList.model");
const asyncHandler = require("./async-handler");

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/** Reads the JWT from the `token` cookie or an `Authorization: Bearer` header. */
function getToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const match = BEARER_PATTERN.exec(req.headers.authorization || "");
  return match ? match[1] : null;
}

/** Tokens are stored hashed in the blacklist so a database leak does not expose live JWTs. */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Builds an authentication middleware.
 * @param {{ systemOnly?: boolean }} options  Require the `systemUser` flag when true.
 */
function authenticate({ systemOnly = false } = {}) {
  return asyncHandler(async (req, res, next) => {
    const token = getToken(req);
    if (!token) {
      return res.status(401).json({ message: "Authentication token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ message: "Invalid or expired authentication token" });
    }

    if (await tokenBlacklistModel.exists({ tokenHash: hashToken(token) })) {
      return res.status(401).json({ message: "Authentication token has been revoked" });
    }

    const query = userModel.findById(decoded.userId);
    if (systemOnly) query.select("+systemUser");
    const user = await query;

    if (!user) return res.status(401).json({ message: "User no longer exists" });
    if (systemOnly && !user.systemUser) {
      return res.status(403).json({ message: "System-user access required" });
    }

    req.user = user;
    req.authToken = token;
    return next();
  });
}

module.exports = {
  authMiddleware: authenticate(),
  authSystemUserMiddleware: authenticate({ systemOnly: true }),
  getToken,
  hashToken,
};
