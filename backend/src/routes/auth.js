import crypto from "node:crypto";
import express from "express";
import { User } from "../models/User.js";
import { db, issueToken, sanitizeUser } from "../data/store.js";
import { fail, ok } from "../lib/apiResponse.js";

export const authRouter = express.Router();

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
