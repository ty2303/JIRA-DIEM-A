import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { fail, ok } from "./lib/apiResponse.js";
import { attachUser } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { categoriesRouter } from "./routes/categories.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { reviewsRouter } from "./routes/reviews.js";
import { uploadRouter } from "./routes/upload.js";
import { usersRouter } from "./routes/users.js";
import { wishlistRouter } from "./routes/wishlist.js";
import { cartRouter } from "./routes/cart.js";

dotenv.config();

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? "*",
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use(attachUser);

app.get("/health", (_req, res) => {
  res.json(ok({ service: "backend", uptime: process.uptime() }));
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/cart", cartRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/users", usersRouter);

app.use((_req, res) => {
  res.status(404).json(fail("Not found", 404));
});
