import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import { WebSocket } from "ws";
import { app } from "../src/app.js";
import { db } from "../src/data/store.js";
import { attachRealtimeServer } from "../src/lib/realtime.js";

// ─── Server helpers ───────────────────────────────────────────────────────────

async function withServer(run) {
	const server = http.createServer(app);
	attachRealtimeServer(server);
	server.listen(0);
	const { port } = server.address();

	try {
		await run(port);
	} finally {
		server.close();
	}
}

// ─── Test data helpers ────────────────────────────────────────────────────────

function createTestOrder(overrides = {}) {
	const order = {
		id: `order-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
		userId: "user-1",
		email: "demo@example.com",
		customerName: "Demo User",
		phone: "0900000001",
		address: "123 Duong Nguyen Hue",
		city: "TP.HCM",
		district: "Quan 1",
		ward: "Ben Nghe",
		note: "Test order",
		paymentMethod: "COD",
		status: "PENDING",
		items: [
			{
				productId: "prod-iphone-15",
				productName: "iPhone 15 Pro",
				price: 27990000,
				quantity: 1,
			},
		],
		subtotal: 27990000,
		shippingFee: 0,
		discount: 0,
		total: 27990000,
		createdAt: new Date().toISOString(),
		paymentStatus: "UNPAID",
		...overrides,
	};

	db.orders.unshift(order);
	return order;
}

function removeTestOrder(orderId) {
	db.orders = db.orders.filter((order) => order.id !== orderId);
}

function removeTestUserByEmail(email) {
	db.users = db.users.filter((user) => user.email !== email);
}

// ─── WebSocket helpers ────────────────────────────────────────────────────────

function buildFrame(command, headers = {}, body = "") {
	const lines = [command];
	for (const [key, value] of Object.entries(headers)) {
		lines.push(`${key}:${value}`);
	}
	return `${lines.join("\n")}\n\n${body}\0`;
}

function parseFrame(frameText) {
	const normalized = frameText.replace(/\r/g, "");
	const separatorIndex = normalized.indexOf("\n\n");
	const headerBlock = normalized.slice(0, separatorIndex);
	const body = normalized.slice(separatorIndex + 2);
	const [command, ...headerLines] = headerBlock.split("\n");
	const headers = {};

	for (const line of headerLines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;
		headers[line.slice(0, colonIndex)] = line.slice(colonIndex + 1);
	}

	return { command, headers, body };
}

function waitForFrame(ws, timeoutMs = 5000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(`waitForFrame timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		const cleanup = () => {
			clearTimeout(timer);
			ws.off("message", onMessage);
			ws.off("error", onError);
			ws.off("close", onClose);
		};

		const onMessage = (data) => {
			const frames = data
				.toString()
				.split("\0")
				.filter((frame) => frame && frame.replace(/\r?\n/g, "").trim())
				.map(parseFrame);

			if (frames.length > 0) {
				cleanup();
				resolve(frames[0]);
			}
		};

		const onError = (error) => { cleanup(); reject(error); };
		const onClose = () => { cleanup(); reject(new Error("WebSocket closed before frame")); };

		ws.on("message", onMessage);
		ws.on("error", onError);
		ws.on("close", onClose);
	});
}

async function connectAndSubscribe(port, token, destination) {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

	await new Promise((resolve, reject) => {
		ws.once("open", resolve);
		ws.once("error", reject);
	});

	ws.send(buildFrame("CONNECT", {
		Authorization: `Bearer ${token}`,
		"accept-version": "1.2",
		"heart-beat": "0,0",
	}));

	const connectedFrame = await waitForFrame(ws);
	assert.equal(connectedFrame.command, "CONNECTED");

	ws.send(buildFrame("SUBSCRIBE", {
		id: "sub-1",
		destination,
		receipt: "sub-1-ready",
	}));

	const receiptFrame = await waitForFrame(ws);
	assert.equal(receiptFrame.command, "RECEIPT");
	assert.equal(receiptFrame.headers["receipt-id"], "sub-1-ready");

	return ws;
}

// =============================================================================
// HEALTH
// =============================================================================

test("GET /health returns service status", async () => {
	await withServer(async (port) => {
		const response = await fetch(`http://127.0.0.1:${port}/health`);
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.equal(body.data.service, "backend");
	});
});

// =============================================================================
// AUTH — Local
// =============================================================================

describe("Auth - local", () => {
	afterEach(() => {
		removeTestUserByEmail("newuser_test@example.com");
	});

	test("POST /api/auth/register creates a new user and returns token", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: "newuser_test",
					email: "newuser_test@example.com",
					password: "password123",
				}),
			});
			const body = await res.json();

			assert.equal(res.status, 201);
			assert.ok(body.data.token);
			assert.equal(body.data.username, "newuser_test");
			assert.equal(body.data.role, "USER");
		});
	});

	test("POST /api/auth/register rejects duplicate username", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: "demo",
					email: "other@example.com",
					password: "password123",
				}),
			});
			const body = await res.json();

			assert.equal(res.status, 409);
			assert.ok(body.errors?.username);
		});
	});

	test("POST /api/auth/register validates username format", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: "bad user!",
					email: "test@example.com",
					password: "password123",
				}),
			});
			assert.equal(res.status, 400);
		});
	});

	test("POST /api/auth/login returns token for valid credentials", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: "demo", password: "123456" }),
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(body.data.token);
		});
	});

	test("POST /api/auth/login rejects wrong password", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: "demo", password: "wrongpassword" }),
			});
			assert.equal(res.status, 401);
		});
	});

	test("POST /api/auth/login rejects missing fields", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: "demo" }),
			});
			assert.equal(res.status, 400);
		});
	});

	test("POST /api/auth/forgot-password always returns 200", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "anyone@example.com" }),
			});
			assert.equal(res.status, 200);
		});
	});

	test("POST /api/auth/reset-password always returns 200", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: "abc", newPassword: "newpass123" }),
			});
			assert.equal(res.status, 200);
		});
	});
});

// =============================================================================
// PRODUCTS
// =============================================================================

describe("Products", () => {
	test("GET /api/products returns paginated list", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/products`);
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(Array.isArray(body.data.content));
			assert.ok(body.data.content.length > 0);
			assert.ok(typeof body.data.totalElements === "number");
		});
	});

	test("GET /api/products/:id returns a single product", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/products/prod-iphone-15`);
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.equal(body.data.id, "prod-iphone-15");
			assert.equal(body.data.name, "iPhone 15 Pro");
			assert.ok(typeof body.data.price === "number");
			assert.ok(typeof body.data.stock === "number");
		});
	});

	test("GET /api/products/:id returns 404 for unknown id", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/products/does-not-exist`);
			assert.equal(res.status, 404);
		});
	});

	test("GET /api/products filters by category", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/products?categoryId=cat-iphone`);
			const body = await res.json();

			assert.equal(res.status, 200);
			const ids = body.data.content.map((p) => p.id);
			assert.ok(ids.includes("prod-iphone-15"));
		});
	});

	test("GET /api/products searches by name", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/products?search=iPhone`);
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(body.data.content.some((p) => p.name.includes("iPhone")));
		});
	});
});

// =============================================================================
// CATEGORIES
// =============================================================================

describe("Categories", () => {
	test("GET /api/categories returns all categories", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/categories`);
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(Array.isArray(body.data));
			assert.ok(body.data.length > 0);
			assert.ok(body.data[0].name);
			assert.ok(body.data[0].slug);
		});
	});
});

// =============================================================================
// CART
// =============================================================================

describe("Cart", () => {
	afterEach(() => {
		delete db.carts["user-1"];
	});

	test("GET /api/cart returns empty cart for new user", async () => {
		await withServer(async (port) => {
			delete db.carts["user-1"];
			const res = await fetch(`http://127.0.0.1:${port}/api/cart`, {
				headers: { Authorization: "Bearer demo-token" },
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(Array.isArray(body.data.items));
			assert.equal(body.data.items.length, 0);
		});
	});

	test("POST /api/cart/items adds a product to cart", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ productId: "prod-iphone-15", quantity: 1 }),
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(body.data.items.some((item) => item.productId === "prod-iphone-15"));
		});
	});

	test("POST /api/cart/items rejects out-of-stock product", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ productId: "prod-out-of-stock", quantity: 1 }),
			});
			assert.equal(res.status, 409);
		});
	});

	test("DELETE /api/cart/items/:productId removes item from cart", async () => {
		await withServer(async (port) => {
			db.carts["user-1"] = [{ productId: "prod-iphone-15", quantity: 1 }];

			const res = await fetch(`http://127.0.0.1:${port}/api/cart/items/prod-iphone-15`, {
				method: "DELETE",
				headers: { Authorization: "Bearer demo-token" },
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.equal(body.data.items.length, 0);
		});
	});

	test("DELETE /api/cart clears all cart items", async () => {
		await withServer(async (port) => {
			db.carts["user-1"] = [
				{ productId: "prod-iphone-15", quantity: 1 },
				{ productId: "prod-galaxy-s25", quantity: 2 },
			];

			const res = await fetch(`http://127.0.0.1:${port}/api/cart`, {
				method: "DELETE",
				headers: { Authorization: "Bearer demo-token" },
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.equal(body.data.items.length, 0);
		});
	});

	test("GET /api/cart rejects unauthenticated requests", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/cart`);
			assert.equal(res.status, 401);
		});
	});
});

// =============================================================================
// ORDERS
// =============================================================================

describe("Order pricing", () => {
	test("POST /api/orders calculates shipping fee and discount on the backend", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "demo@example.com",
					customerName: "Demo User",
					phone: "0900000001",
					address: "123 Duong Nguyen Hue",
					city: "TP.HCM",
					district: "Quan 1",
					ward: "Ben Nghe",
					paymentMethod: "COD",
					discount: 50000,
					items: [
						{
							productId: "prod-iphone-15",
							productName: "iPhone 15 Pro",
							productImage: "",
							brand: "Apple",
							price: 100000,
							quantity: 1,
						},
					],
				}),
			});
			const body = await response.json();

			assert.equal(response.status, 201);
			assert.equal(body.data.subtotal, 100000);
			assert.equal(body.data.shippingFee, 30000);
			assert.equal(body.data.discount, 50000);
			assert.equal(body.data.total, 80000);
			assert.equal(body.data.paymentStatus, "UNPAID");
			assert.equal(body.data.paymentMethod, "COD");

			db.orders = db.orders.filter((o) => o.id !== body.data.id);
		});
	});

	test("POST /api/orders returns free shipping once subtotal reaches the frontend threshold", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "demo@example.com",
					customerName: "Demo User",
					phone: "0900000001",
					address: "123 Duong Nguyen Hue",
					city: "TP.HCM",
					district: "Quan 1",
					ward: "Ben Nghe",
					paymentMethod: "COD",
					items: [
						{
							productId: "prod-iphone-15",
							productName: "iPhone 15 Pro",
							productImage: "",
							brand: "Apple",
							price: 500000,
							quantity: 1,
						},
					],
				}),
			});
			const body = await response.json();

			assert.equal(response.status, 201);
			assert.equal(body.data.subtotal, 500000);
			assert.equal(body.data.shippingFee, 0);
			assert.equal(body.data.discount, 0);
			assert.equal(body.data.total, 500000);

			db.orders = db.orders.filter((o) => o.id !== body.data.id);
		});
	});

	test("GET /api/orders/:id lets the owner view order details", async () => {
		await withServer(async (port) => {
			const response = await fetch(
				`http://127.0.0.1:${port}/api/orders/order-1`,
				{ headers: { Authorization: "Bearer demo-token" } },
			);
			const body = await response.json();

			assert.equal(response.status, 200);
			assert.equal(body.data.id, "order-1");
			assert.equal(body.data.paymentMethod, "COD");
		});
	});

	test("POST /api/orders rejects unauthenticated request", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/orders`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "a@b.com" }),
			});
			assert.equal(res.status, 401);
		});
	});
});

test("PATCH /api/orders/:id/cancel restores stock for fallback-created orders", async () => {
	await withServer(async (port) => {
		const product = db.products.find((item) => item.id === "prod-iphone-15");
		assert.ok(product);
		const initialStock = product.stock;
		let createdOrderId;

		try {
			const createResponse = await fetch(`http://127.0.0.1:${port}/api/orders`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "demo@example.com",
					customerName: "Demo User",
					phone: "0900000001",
					address: "123 Duong Nguyen Hue",
					city: "TP.HCM",
					district: "Quan 1",
					ward: "Ben Nghe",
					paymentMethod: "COD",
					items: [
						{
							productId: "prod-iphone-15",
							productName: "iPhone 15 Pro",
							productImage: "",
							brand: "Apple",
							price: 27990000,
							quantity: 2,
						},
					],
				}),
			});
			const createBody = await createResponse.json();
			createdOrderId = createBody.data.id;

			assert.equal(createResponse.status, 201);
			assert.equal(product.stock, initialStock - 2);

			const cancelResponse = await fetch(
				`http://127.0.0.1:${port}/api/orders/${createdOrderId}/cancel?reason=Kh%C3%B4ng%20c%C3%B2n%20nhu%20c%E1%BA%A7u`,
				{
					method: "PATCH",
					headers: { Authorization: "Bearer demo-token" },
				},
			);
			const cancelBody = await cancelResponse.json();

			assert.equal(cancelResponse.status, 200);
			assert.equal(cancelBody.data.status, "CANCELLED");
			assert.equal(product.stock, initialStock);
		} finally {
			product.stock = initialStock;
			product.updatedAt = new Date().toISOString();
			if (createdOrderId) {
				db.orders = db.orders.filter((order) => order.id !== createdOrderId);
			}
		}
	});
});

// =============================================================================
// REVIEWS (no AI analysis)
// =============================================================================

describe("Reviews", () => {
	afterEach(() => {
		db.reviews = db.reviews.filter((r) => r.id === "review-1" || r.id === "review-2");
		const iphone = db.products.find((p) => p.id === "prod-iphone-15");
		if (iphone) iphone.rating = 4.9;
		const galaxy = db.products.find((p) => p.id === "prod-galaxy-s25");
		if (galaxy) galaxy.rating = 4.8;
	});

	test("GET /api/reviews returns all reviews", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/reviews`);
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(Array.isArray(body.data));
		});
	});

	test("GET /api/reviews?productId filters by product", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/reviews?productId=prod-iphone-15`);
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.ok(body.data.every((r) => r.productId === "prod-iphone-15"));
		});
	});

	test("POST /api/reviews creates a review without analysisResults", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/reviews`, {
				method: "POST",
				headers: {
					Authorization: "Bearer admin-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					productId: "prod-galaxy-s25",
					rating: 5,
					comment: "May dep, chay muot, pin trau",
					images: [],
				}),
			});
			const body = await res.json();

			assert.equal(res.status, 201);
			assert.equal(body.data.productId, "prod-galaxy-s25");
			assert.equal(body.data.rating, 5);
			assert.ok(body.data.comment);
			// No analysisResults field expected
			assert.equal(body.data.analysisResults, undefined);
		});
	});

	test("POST /api/reviews rejects review with rating out of range", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/reviews`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					productId: "prod-iphone-15",
					rating: 6,
					comment: "Too good",
				}),
			});
			assert.equal(res.status, 400);
		});
	});

	test("PUT /api/reviews/:id updates review content", async () => {
		const existingReview = db.reviews.find((r) => r.id === "review-1");
		assert.ok(existingReview);
		const snapshot = structuredClone(existingReview);

		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/reviews/review-1`, {
				method: "PUT",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					productId: "prod-iphone-15",
					rating: 3,
					comment: "Updated comment",
					images: [],
				}),
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.equal(body.data.rating, 3);
			assert.equal(body.data.comment, "Updated comment");
			// No analysisResults expected
			assert.equal(body.data.analysisResults, undefined);
		});

		Object.assign(existingReview, snapshot);
	});

	test("DELETE /api/reviews/:id removes the review", async () => {
		const review = {
			id: "review-del-test",
			productId: "prod-iphone-15",
			userId: "user-1",
			username: "demo",
			rating: 4,
			comment: "To be deleted",
			images: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		db.reviews.push(review);

		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/reviews/review-del-test`, {
				method: "DELETE",
				headers: { Authorization: "Bearer demo-token" },
			});
			assert.equal(res.status, 200);
			assert.ok(!db.reviews.find((r) => r.id === "review-del-test"));
		});
	});
});

// =============================================================================
// AUTH MIDDLEWARE
// =============================================================================

describe("Auth middleware", () => {
	test("admin middleware rejects unauthenticated requests", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test product" }),
			});
			const body = await response.json();

			assert.equal(response.status, 401);
			assert.equal(body.message, "Unauthorized");
		});
	});

	test("admin middleware rejects non-admin users", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
				method: "POST",
				headers: {
					Authorization: "Bearer demo-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Test product" }),
			});
			const body = await response.json();

			assert.equal(response.status, 403);
			assert.equal(body.message, "Forbidden");
		});
	});

	test("admin middleware allows admin users", async () => {
		await withServer(async (port) => {
			const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
				method: "POST",
				headers: {
					Authorization: "Bearer admin-token",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: "Test product",
					brand: "Test brand",
					categoryId: "cat-iphone",
					price: 1000,
					originalPrice: 1200,
					image: "https://example.com/test.jpg",
					specs: "Test specs",
				}),
			});
			const body = await response.json();

			assert.equal(response.status, 201);
			assert.equal(body.message, "Tao san pham thanh cong");
			assert.equal(body.data.name, "Test product");
		});
	});
});

// =============================================================================
// USERS
// =============================================================================

describe("Users", () => {
	test("GET /api/users/me returns current user profile", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/users/me`, {
				headers: { Authorization: "Bearer demo-token" },
			});
			const body = await res.json();

			assert.equal(res.status, 200);
			assert.equal(body.data.username, "demo");
			assert.equal(body.data.password, undefined);
		});
	});

	test("GET /api/users/me rejects unauthenticated request", async () => {
		await withServer(async (port) => {
			const res = await fetch(`http://127.0.0.1:${port}/api/users/me`);
			assert.equal(res.status, 401);
		});
	});
});

// =============================================================================
// WEBSOCKET — Realtime order/role notifications
// =============================================================================

// sendToUser(order.userId, "/user/queue/order-status", { orderId, newStatus })
// so we subscribe as the order owner (demo-token / user-1) to /user/queue/order-status
describe("WebSocket - order notifications", () => {
	test("order owner receives status update notification via WebSocket", async () => {
		await withServer(async (port) => {
			const testOrder = createTestOrder({ status: "PENDING" });

			try {
				const ws = await connectAndSubscribe(port, "demo-token", "/user/queue/order-status");

				// Start listening BEFORE the HTTP request so we don't miss the frame.
				// Use a 15s timeout to account for Mongoose's 10s buffer timeout on fallback.
				const framePromise = waitForFrame(ws, 15000);

				const updateRes = await fetch(
					`http://127.0.0.1:${port}/api/orders/${testOrder.id}/status?status=CONFIRMED`,
					{
						method: "PATCH",
						headers: { Authorization: "Bearer admin-token" },
					},
				);
				assert.equal(updateRes.status, 200);

				const frame = await framePromise;
				assert.equal(frame.command, "MESSAGE");
				const payload = JSON.parse(frame.body);
				assert.equal(payload.orderId, testOrder.id);
				assert.equal(payload.newStatus, "CONFIRMED");

				ws.close();
			} finally {
				removeTestOrder(testOrder.id);
			}
		});
	});

	test("second subscriber on same destination also receives notification", async () => {
		await withServer(async (port) => {
			const testOrder = createTestOrder({ status: "PENDING" });

			try {
				// Open two connections as the same user (user-1 / demo-token)
				const ws1 = await connectAndSubscribe(port, "demo-token", "/user/queue/order-status");
				const ws2 = await connectAndSubscribe(port, "demo-token", "/user/queue/order-status");

				// Start listening BEFORE the HTTP request (15s timeout for Mongoose fallback)
				const frame1Promise = waitForFrame(ws1, 15000);
				const frame2Promise = waitForFrame(ws2, 15000);

				const updateRes = await fetch(
					`http://127.0.0.1:${port}/api/orders/${testOrder.id}/status?status=CONFIRMED`,
					{
						method: "PATCH",
						headers: { Authorization: "Bearer admin-token" },
					},
				);
				assert.equal(updateRes.status, 200);

				const [frame1, frame2] = await Promise.all([frame1Promise, frame2Promise]);
				assert.equal(frame1.command, "MESSAGE");
				assert.equal(frame2.command, "MESSAGE");

				ws1.close();
				ws2.close();
			} finally {
				removeTestOrder(testOrder.id);
			}
		});
	});
});

// =============================================================================
// 404 — Unknown routes
// =============================================================================

test("unknown route returns 404", async () => {
	await withServer(async (port) => {
		const res = await fetch(`http://127.0.0.1:${port}/api/does-not-exist`);
		assert.equal(res.status, 404);
	});
});
