import crypto from "node:crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { db, issueToken, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";

export const authRouter = express.Router();

// ---------------------------------------------------------------------------
// OAuth state store — CSRF protection cho Authorization Code Flow
// key: state hex string, value: expiry timestamp (ms)
// ---------------------------------------------------------------------------
export const oauthStateStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [state, expiry] of oauthStateStore) {
    if (now > expiry) oauthStateStore.delete(state);
  }
}, 15 * 60 * 1000).unref();

let cachedGoogleClientId = "";
let cachedGoogleClient = null;

function getGoogleVerifier() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  if (!clientId) {
    return null;
  }

  if (!cachedGoogleClient || cachedGoogleClientId !== clientId) {
    cachedGoogleClient = new OAuth2Client(clientId);
    cachedGoogleClientId = clientId;
  }

  return { clientId, client: cachedGoogleClient };
}

const GOOGLE_USERNAME_MAX_LENGTH = 30;

function sanitizeUsernameSegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildGoogleUsernameSeed(payload) {
  const emailLocalPart = typeof payload.email === "string" ? payload.email.split("@")[0] : "";
  const profileName = typeof payload.name === "string" ? payload.name : "";

  const sanitizedFromName = sanitizeUsernameSegment(profileName);
  if (sanitizedFromName.length >= 3) {
    return sanitizedFromName.slice(0, GOOGLE_USERNAME_MAX_LENGTH);
  }

  const sanitizedFromEmail = sanitizeUsernameSegment(emailLocalPart);
  if (sanitizedFromEmail.length >= 3) {
    return sanitizedFromEmail.slice(0, GOOGLE_USERNAME_MAX_LENGTH);
  }

  return "google_user";
}

async function resolveUniqueUsername(baseUsername) {
  const base = baseUsername.slice(0, GOOGLE_USERNAME_MAX_LENGTH);
  let candidate = base;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const mongoMatch = await User.findOne({ username: candidate });
    const memoryMatch = db.users.find((user) => user.username === candidate);
    if (!mongoMatch && !memoryMatch) {
      return candidate;
    }

    const suffix = crypto.randomBytes(2).toString("hex");
    const head = base.slice(0, Math.max(3, GOOGLE_USERNAME_MAX_LENGTH - suffix.length - 1));
    candidate = `${head}_${suffix}`;
  }

  return `${base.slice(0, 21)}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * GET /api/auth/google/redirect
 * Tạo Google OAuth authorization URL và redirect người dùng đến trang đăng nhập Google.
 * Sử dụng Authorization Code Flow với PKCE-equivalent state để chống CSRF.
 */
authRouter.get("/google/redirect", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(503).json(
      fail(
        "Google OAuth chưa được cấu hình (thiếu GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET hoặc GOOGLE_REDIRECT_URI)",
        503,
      ),
    );
  }

  const oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);

  const state = crypto.randomBytes(16).toString("hex");
  oauthStateStore.set(state, Date.now() + 10 * 60 * 1000); // hết hạn sau 10 phút

  const authUrl = oauthClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });

  return res.redirect(302, authUrl);
});

/**
 * POST /api/auth/login
 * Đăng nhập bằng username + password.
 */
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json(fail("Vui lòng nhập tên đăng nhập và mật khẩu", 400));
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }

    const token = issueToken(user._id.toString());
    return res.json(ok({ token, ...sanitizeUser(user) }, "Đăng nhập thành công"));
  } catch (error) {
    console.error("Login error:", error);
    // In-memory fallback (plain-text password comparison for seed users)
    const memUser = db.users.find((u) => u.username === username);
    if (!memUser || memUser.password !== password) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }
    const token = issueToken(memUser.id);
    return res.json(ok({ token, ...sanitizeUser(memUser) }, "Đăng nhập thành công"));
  }
});

/**
 * POST /api/auth/google
 * Đăng nhập bằng Google ID token.
 */
authRouter.post("/google", async (req, res) => {
  const { credential } = req.body;

  if (typeof credential !== "string" || credential.trim().length === 0) {
    return res.status(400).json(fail("Thiếu Google credential", 400));
  }

  const googleVerifier = getGoogleVerifier();
  if (!googleVerifier) {
    return res.status(503).json(
      fail("Google login chưa được cấu hình trên máy chủ (thiếu GOOGLE_CLIENT_ID)", 503),
    );
  }

  let payload;
  try {
    const ticket = await googleVerifier.client.verifyIdToken({
      idToken: credential,
      audience: googleVerifier.clientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Google verify error:", error);
    return res.status(401).json(fail("Google token không hợp lệ hoặc đã hết hạn", 401));
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    return res.status(401).json(fail("Tài khoản Google không hợp lệ", 401));
  }

  const normalizedEmail = payload.email.trim().toLowerCase();

  try {
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const username = await resolveUniqueUsername(buildGoogleUsernameSeed(payload));
      const generatedPassword = `google_${crypto.randomUUID()}`;
      user = await User.create({
        username,
        email: normalizedEmail,
        password: generatedPassword,
        role: "USER",
      });
    }

    const token = issueToken(user._id.toString());
    return res.json(ok({ token, ...sanitizeUser(user) }, "Đăng nhập Google thành công"));
  } catch (error) {
    console.error("Google login storage error:", error);

    if (error?.code === 11000) {
      try {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          const token = issueToken(existingUser._id.toString());
          return res.json(ok({ token, ...sanitizeUser(existingUser) }, "Đăng nhập Google thành công"));
        }
      } catch (lookupError) {
        console.error("Google duplicate lookup error:", lookupError);
      }
    }

    return res.status(503).json(
      fail("Không thể xử lý đăng nhập Google lúc này, vui lòng thử lại", 503),
    );
  }
});

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới.
 */
authRouter.post("/register", async (req, res) => {
  const rawUsername = req.body.username;
  const rawEmail = req.body.email;
  const { password } = req.body;

  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const errors = {};

  if (!username) errors.username = ["Vui lòng nhập tên đăng nhập"];
  if (!email) errors.email = ["Vui lòng nhập email"];
  if (!password) errors.password = ["Vui lòng nhập mật khẩu"];

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(fail("Vui lòng nhập đầy đủ thông tin đăng ký", 400, errors));
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json(
      fail("Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới, dài 3-30 ký tự", 400, {
        username: ["Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới, dài 3-30 ký tự"],
      })
    );
  }

  if (password.length < 6) {
    return res.status(400).json(
      fail("Mật khẩu phải có ít nhất 6 ký tự", 400, {
        password: ["Mật khẩu phải có ít nhất 6 ký tự"],
      })
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json(
      fail("Email không hợp lệ", 400, { email: ["Email không hợp lệ"] })
    );
  }

  try {
    const exists = await User.findOne({ $or: [{ username }, { email }] });

    if (exists) {
      const isUsernameTaken = exists.username === username;
      const field = isUsernameTaken ? "username" : "email";
      const label = isUsernameTaken ? "Tên đăng nhập" : "Email";
      return res.status(409).json(
        fail(`${label} đã được sử dụng`, 409, { [field]: [`${label} đã được sử dụng`] })
      );
    }

    const user = await User.create({ username, email, password, role: "USER" });
    const token = issueToken(user._id.toString());

    return res.status(201).json(ok({ token, ...sanitizeUser(user) }, "Đăng ký thành công", 201));
  } catch (error) {
    console.error("Register error:", error);

    if (error.code === 11000) {
      const dupField = Object.keys(error.keyPattern || {})[0];
      const label = dupField === "username" ? "Tên đăng nhập" : "Email";
      return res.status(409).json(
        fail(`${label} đã được sử dụng`, 409, { [dupField]: [`${label} đã được sử dụng`] })
      );
    }

    // In-memory fallback
    const exists = db.users.find((u) => u.username === username || u.email === email);
    if (exists) {
      const isUsernameTaken = exists.username === username;
      const field = isUsernameTaken ? "username" : "email";
      const label = isUsernameTaken ? "Tên đăng nhập" : "Email";
      return res.status(409).json(
        fail(`${label} đã được sử dụng`, 409, { [field]: [`${label} đã được sử dụng`] })
      );
    }

    const newUser = {
      id: crypto.randomUUID(),
      username,
      email,
      password,
      role: "USER",
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    const token = issueToken(newUser.id);
    return res.status(201).json(ok({ token, ...sanitizeUser(newUser) }, "Đăng ký thành công", 201));
  }
});

/**
 * POST /api/auth/forgot-password
 */
authRouter.post("/forgot-password", (_req, res) => {
  res.json(ok(null, "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi"));
});

/**
 * POST /api/auth/reset-password
 */
authRouter.post("/reset-password", (_req, res) => {
  res.json(ok(null, "Đặt lại mật khẩu thành công"));
});
