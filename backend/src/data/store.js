import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { calculateOrderPricing } from "../lib/orderPricing.js";

const now = () => new Date().toISOString();

const JWT_SECRET = process.env.JWT_SECRET || "development-secret";
const JWT_EXPIRES_IN = "7d";
const reservedStockOrderIds = new Set();

export const db = {
	users: [
		{
			id: "user-1",
			username: "demo",
			email: "demo@example.com",
			password: "123456",
			role: "USER",
	
				createdAt: now(),
		},
		{
			id: "admin-1",
			username: "admin",
			email: "admin@example.com",
			password: "admin123",
			role: "ADMIN",
	
				createdAt: now(),
		},
	],
	categories: [
		{
			id: "cat-iphone",
			name: "iPhone",
			slug: "iphone",
			description: "Apple iPhone",
			icon: "Smartphone",
			createdAt: now(),
		},
		{
			id: "cat-samsung",
			name: "Samsung",
			slug: "samsung",
			description: "Samsung Galaxy",
			icon: "Smartphone",
			createdAt: now(),
		},
		{
			id: "cat-xiaomi",
			name: "Xiaomi",
			slug: "xiaomi",
			description: "Xiaomi va Redmi",
			icon: "Smartphone",
			createdAt: now(),
		},
		{
			id: "cat-oppo",
			name: "OPPO",
			slug: "oppo",
			description: "OPPO Reno va Find",
			icon: "Smartphone",
			createdAt: now(),
		},
	],
	products: [
		{
			id: "prod-iphone-15",
			name: "iPhone 15 Pro",
			brand: "Apple",
			categoryId: "cat-iphone",
			price: 27990000,
			originalPrice: 30990000,
			image:
				"https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80",
			rating: 4.9,
			badge: "Ban chay",
			specs: "A17 Pro, 256GB, Titanium",
			stock: 12,
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: "prod-galaxy-s25",
			name: "Galaxy S25 Ultra",
			brand: "Samsung",
			categoryId: "cat-samsung",
			price: 26990000,
			originalPrice: 29990000,
			image:
				"https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80",
			rating: 4.8,
			badge: "Moi",
			specs: "Snapdragon, 512GB, AI Camera",
			stock: 8,
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: "prod-xiaomi-14",
			name: "Xiaomi 14",
			brand: "Xiaomi",
			categoryId: "cat-xiaomi",
			price: 18990000,
			originalPrice: 20990000,
			image:
				"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
			rating: 4.7,
			badge: "Gia tot",
			specs: "Snapdragon 8 Gen 3, 256GB, Leica Camera",
			stock: 15,
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: "prod-oppo-find-x8",
			name: "OPPO Find X8",
			brand: "OPPO",
			categoryId: "cat-oppo",
			price: 21990000,
			originalPrice: 23990000,
			image:
				"https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80",
			rating: 4.6,
			badge: "Noi bat",
			specs: "Dimensity flagship, 512GB, Hasselblad Camera",
			stock: 10,
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: "prod-out-of-stock",
			name: "iPhone 14 (Het hang)",
			brand: "Apple",
			categoryId: "cat-iphone",
			price: 19990000,
			image:
				"https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80",
			rating: 4.5,
			specs: "A16, 128GB",
			stock: 0,
			createdAt: now(),
			updatedAt: now(),
		},
	],
	orders: [
		{
			id: "order-1",
			userId: "user-1",
			email: "demo@example.com",
			customerName: "Demo User",
			phone: "0900000001",
			address: "123 Duong Nguyen Hue",
			city: "TP.HCM",
			district: "Quan 1",
			ward: "Ben Nghe",
			note: "Giao gio hanh chinh",
			paymentMethod: "COD",
			status: "DELIVERED",
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
			createdAt: now(),
			paymentStatus: "PAID",
		},
	],
	reviews: [
		{
			id: "review-1",
			productId: "prod-iphone-15",
			userId: "user-1",
			username: "demo",
			rating: 5,
			comment: "San pham dep, giao hang nhanh.",
			images: [],
			createdAt: now(),
			updatedAt: now(),
		},
		{
			id: "review-2",
			productId: "prod-galaxy-s25",
			userId: "user-1",
			username: "demo",
			rating: 4,
			comment: "May manh, man hinh dep, camera on.",
			images: [],
			createdAt: now(),
			updatedAt: now(),
		},
	],
	wishlists: {
		"user-1": ["prod-iphone-15"],
	},
	carts: {},
	tokens: new Map([
		["demo-token", "user-1"],
		["admin-token", "admin-1"],
	]),
};

export function withCategory(product) {
	const category = db.categories.find((item) => item.id === product.categoryId);
	return {
		...product,
		categoryName: category?.name ?? "",
	};
}

export function paginate(items, page = 0, size = 10) {
	const safePage = Number.isFinite(page) ? page : 0;
	const safeSize = Number.isFinite(size) ? size : 10;
	const start = safePage * safeSize;

	return {
		content: items.slice(start, start + safeSize),
		number: safePage,
		size: safeSize,
		totalPages: Math.max(1, Math.ceil(items.length / safeSize)),
		totalElements: items.length,
	};
}

/**
 * Tạo JWT token cho userId.
 * @param {string} userId
 * @returns {string} JWT token
 */
export function issueToken(userId) {
	return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token và trả về userId.
 * @param {string} token
 * @returns {string|null} userId hoặc null nếu token không hợp lệ
 */
export function verifyToken(token) {
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		return decoded.userId ?? null;
	} catch {
		return null;
	}
}

/**
 * Lấy user từ in-memory store theo token (fallback cho legacy tokens).
 * @param {string} token
 * @returns {object|null}
 */
export function getUserByToken(token) {
	// Thử verify JWT trước
	const userId = verifyToken(token);
	if (userId) {
		// Tìm trong in-memory store (fallback)
		return db.users.find((user) => user.id === userId) ?? null;
	}

	// Fallback: legacy token trong Map
	const legacyUserId = db.tokens.get(token);
	return db.users.find((user) => user.id === legacyUserId) ?? null;
}

/**
 * Sanitize user object - loại bỏ password và các trường nội bộ.
 * Hỗ trợ cả Mongoose document và plain object.
 * @param {object} user - User object (Mongoose doc hoặc plain)
 * @returns {object} User object đã loại bỏ thông tin nhạy cảm
 */
export function sanitizeUser(user) {
	// Nếu là Mongoose document, convert sang plain object
	const plainUser = user.toObject ? user.toObject() : { ...user };
	const { password, __v, ...safeUser } = plainUser;

	return {
		id: plainUser._id?.toString() ?? plainUser.id,
		...safeUser,
		_id: undefined,
	};
}

export function createOrder(payload, user) {
	for (const item of payload.items) {
		const product = db.products.find((entry) => entry.id === item.productId);
		if (!product) {
			const error = new Error(`Sản phẩm "${item.productName}" không tồn tại`);
			error.status = 404;
			throw error;
		}
		if (product.stock < item.quantity) {
			const error = new Error(
				`Sản phẩm "${product.name}" không đủ hàng (còn ${product.stock})`,
			);
			error.status = 409;
			throw error;
		}
	}

	const pricing = calculateOrderPricing(payload.items, {
		discount: payload.discount,
	});
	const order = {
		id: crypto.randomUUID(),
		userId: user?.id ?? "guest",
		email: payload.email,
		customerName: payload.customerName,
		phone: payload.phone,
		address: payload.address,
		city: payload.city,
		district: payload.district,
		ward: payload.ward,
		note: payload.note ?? "",
		paymentMethod: payload.paymentMethod,
		status: "PENDING",
		items: payload.items,
		...pricing,
		createdAt: now(),
		paymentStatus: "UNPAID",
	};

	for (const item of payload.items) {
		const product = db.products.find((entry) => entry.id === item.productId);
		if (!product) {
			continue;
		}
		product.stock -= item.quantity;
		product.updatedAt = now();
	}

	db.orders.unshift(order);
	reservedStockOrderIds.add(order.id);
	return order;
}

export function restoreReservedStockForOrder(order) {
	if (!reservedStockOrderIds.has(order.id)) {
		return;
	}

	for (const item of order.items) {
		const product = db.products.find((entry) => entry.id === item.productId);
		if (!product) {
			continue;
		}
		product.stock += item.quantity;
		product.updatedAt = now();
	}

	reservedStockOrderIds.delete(order.id);
}

/**
 * Get cart for a user. Returns array of cart items with product info.
 * @param {string} userId
 * @returns {{ items: Array<{ productId: string, quantity: number, product: object }>, total: number }}
 */
export function getCart(userId) {
	const items = (db.carts[userId] ?? [])
		.map((item) => {
			const product = db.products.find((p) => p.id === item.productId);
			return {
				productId: item.productId,
				quantity: item.quantity,
				product: product ? withCategory(product) : null,
			};
		})
		.filter((item) => item.product !== null);

	const total = items.reduce(
		(sum, item) => sum + item.product.price * item.quantity,
		0,
	);

	return { items, total };
}

/**
 * Add item to cart or increment quantity. Returns updated cart.
 * @param {string} userId
 * @param {string} productId
 * @param {number} quantity
 * @returns {{ cart: object } | { error: string, status: number }}
 */
export function addToCartItem(userId, productId, quantity) {
	const product = db.products.find((p) => p.id === productId);
	if (!product) {
		return { error: "Sản phẩm không tồn tại", status: 404 };
	}

	if (!db.carts[userId]) {
		db.carts[userId] = [];
	}

	const existing = db.carts[userId].find((i) => i.productId === productId);
	const currentQty = existing ? existing.quantity : 0;
	const newQty = currentQty + quantity;

	if (product.stock === 0) {
		return { error: "Sản phẩm đã hết hàng", status: 409 };
	}

	if (newQty > product.stock) {
		return { error: `Chỉ còn ${product.stock} sản phẩm`, status: 409 };
	}

	if (newQty > 99 || quantity <= 0) {
		return { error: "Số lượng không hợp lệ", status: 400 };
	}

	if (existing) {
		existing.quantity = newQty;
	} else {
		db.carts[userId].push({ productId, quantity });
	}

	return { cart: getCart(userId) };
}

/**
 * Update quantity of a cart item. Returns updated cart.
 * @param {string} userId
 * @param {string} productId
 * @param {number} quantity
 * @returns {{ cart: object } | { error: string, status: number }}
 */
export function updateCartItem(userId, productId, quantity) {
	if (!db.carts[userId]) {
		return { error: "Giỏ hàng trống", status: 404 };
	}

	const existing = db.carts[userId].find((i) => i.productId === productId);
	if (!existing) {
		return { error: "Sản phẩm không có trong giỏ hàng", status: 404 };
	}

	if (quantity <= 0) {
		return { error: "Số lượng không hợp lệ", status: 400 };
	}

	const product = db.products.find((p) => p.id === productId);
	if (product && quantity > product.stock) {
		return { error: `Chỉ còn ${product.stock} sản phẩm`, status: 409 };
	}

	if (quantity > 99) {
		return { error: "Số lượng không hợp lệ", status: 400 };
	}

	existing.quantity = quantity;
	return { cart: getCart(userId) };
}

/**
 * Remove item from cart. Returns updated cart.
 * @param {string} userId
 * @param {string} productId
 * @returns {{ cart: object }}
 */
export function removeCartItem(userId, productId) {
	if (db.carts[userId]) {
		db.carts[userId] = db.carts[userId].filter(
			(i) => i.productId !== productId,
		);
	}
	return { cart: getCart(userId) };
}

/**
 * Clear all items from cart. Returns empty cart.
 * @param {string} userId
 * @returns {{ cart: object }}
 */
export function clearCart(userId) {
	db.carts[userId] = [];
	return { cart: getCart(userId) };
}
