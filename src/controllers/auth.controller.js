const jwt = require("jsonwebtoken");

const userModel = require("../models/user.model");
const tokenBlacklistModel = require("../models/blackList.model");
const emailService = require("../services/email.service");
const asyncHandler = require("../middleware/async-handler");
const { getToken, hashToken } = require("../middleware/auth.middleware");
const { validateRegistration, validateLogin } = require("../utils/validators");

const COOKIE_NAME = "token";

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
});

function issueToken(user) {
  return jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "3d",
  });
}

/** The cookie lives exactly as long as the JWT, even when JWT_EXPIRES_IN is customised. */
function setTokenCookie(res, token) {
  const { exp } = jwt.decode(token);
  res.cookie(COOKIE_NAME, token, { ...baseCookieOptions(), expires: new Date(exp * 1000) });
}

const publicUser = (user) => ({ _id: user._id, name: user.name, email: user.email });

const userRegisterController = asyncHandler(async (req, res) => {
  const { error, value } = validateRegistration(req.body);
  if (error) return res.status(400).json({ message: error });

  const emailTaken = { message: "An account with this email already exists" };
  if (await userModel.exists({ email: value.email })) return res.status(409).json(emailTaken);

  let user;
  try {
    user = await userModel.create(value);
  } catch (err) {
    // Two simultaneous registrations can both pass the check above; the unique index decides.
    if (err.code === 11000) return res.status(409).json(emailTaken);
    throw err;
  }

  const token = issueToken(user);
  setTokenCookie(res, token);
  res.status(201).json({ user: publicUser(user), token });

  void emailService.sendRegistrationEmail(user.email, user.name);
});

const userLoginController = asyncHandler(async (req, res) => {
  const { error, value } = validateLogin(req.body);
  if (error) return res.status(400).json({ message: error });

  const user = await userModel.findOne({ email: value.email }).select("+password");
  // Same message for "unknown email" and "wrong password" to avoid revealing which emails exist.
  if (!user || !(await user.comparePassword(value.password))) {
    return res.status(401).json({ message: "Email or password is invalid" });
  }

  const token = issueToken(user);
  setTokenCookie(res, token);
  return res.status(200).json({ user: publicUser(user), token });
});

const userLogoutController = asyncHandler(async (req, res) => {
  const token = getToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        ignoreExpiration: true,
      });
      const expiresAt = new Date(decoded.exp * 1000);

      // Only tokens that are still valid need revoking.
      if (expiresAt > new Date()) {
        const tokenHash = hashToken(token);
        await tokenBlacklistModel.updateOne(
          { tokenHash },
          { $setOnInsert: { tokenHash, expiresAt } },
          { upsert: true }
        );
      }
    } catch {
      // A token that fails verification cannot be used anyway; still clear the cookie.
    }
  }

  res.clearCookie(COOKIE_NAME, baseCookieOptions());
  return res.status(200).json({ message: "Logged out successfully" });
});

module.exports = { userRegisterController, userLoginController, userLogoutController };
