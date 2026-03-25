import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import express from "express";
import { db } from "../src/data/store.js";
import { attachUser } from "../src/middleware/auth.js";
import { wishlistRouter } from "../src/routes/wishlist.js";

function createServer() {
	const app = express();
	app.use(express.json());
	app.use(attachUser);
	app.use("/api/wishlist", wishlistRouter);

	const server = http.createServer(app);
	server.listen(0);
	return server;
}

async function withServer(run) {
	const server = createServer();
	const { port } = server.address();

	try {
		await run(port);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

const originalWishlist = [...(db.wishlists["user-1"] ?? [])];

afterEach(() => {
	db.wishlists["user-1"] = [...originalWishlist];
});

describe("Wishlist API", () => {
	test("GET /api/wishlist returns current wishlist", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/wishlist`, {
				headers: {
					Authorization: "Bearer demo-token",
				},
			});
			const body = await res.json();

			assert.strictEqual(res.status, 200);
			assert.deepEqual(
				body.data.map((item) => item.id),
				originalWishlist,
			);
		});
	});

	test("POST /api/wishlist/:productId toggles a product on and off", async () => {
		await withServer(async (port) => {
			const headers = {
				Authorization: "Bearer demo-token",
			};

			const addRes = await fetch(
				`http://127.0.0.1:${port}/api/wishlist/prod-galaxy-s25`,
				{
					method: "POST",
					headers,
				},
			);
			const addBody = await addRes.json();

			assert.strictEqual(addRes.status, 200);
			assert.ok(addBody.data.some((item) => item.id === "prod-galaxy-s25"));

			const removeRes = await fetch(
				`http://127.0.0.1:${port}/api/wishlist/prod-galaxy-s25`,
				{
					method: "POST",
					headers,
				},
			);
			const removeBody = await removeRes.json();

			assert.strictEqual(removeRes.status, 200);
			assert.ok(
				!removeBody.data.some((item) => item.id === "prod-galaxy-s25"),
			);
		});
	});

	test("POST /api/wishlist/:productId rejects nonexistent product ids", async () => {
		await withServer(async (port) => {
			const res = await fetch(
				`http://127.0.0.1:${port}/api/wishlist/prod-does-not-exist`,
				{
					method: "POST",
					headers: {
						Authorization: "Bearer demo-token",
					},
				},
			);
			const body = await res.json();

			assert.strictEqual(res.status, 404);
			assert.strictEqual(body.message, "San pham khong ton tai");
		});
	});

	test("POST /api/wishlist/sync merges guest items into the signed-in user's wishlist", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/wishlist/sync`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					productIds: ["prod-galaxy-s25", "prod-does-not-exist"],
				}),
			});
			const body = await res.json();

			assert.strictEqual(res.status, 200);
			assert.ok(body.data.some((item) => item.id === "prod-galaxy-s25"));
			assert.ok(!body.data.some((item) => item.id === "prod-does-not-exist"));
			assert.ok(db.wishlists["user-1"].includes("prod-galaxy-s25"));
		});
	});

	test("DELETE /api/wishlist clears all items", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/wishlist`, {
				method: "DELETE",
				headers: {
					Authorization: "Bearer demo-token",
				},
			});
			const body = await res.json();

			assert.strictEqual(res.status, 200);
			assert.strictEqual(body.message, "Da xoa wishlist");
			assert.deepEqual(db.wishlists["user-1"], []);
		});
	});
});
