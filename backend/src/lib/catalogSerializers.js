export function serializeCategory(category, productCount = 0) {
  return {
    id: category._id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    icon: category.icon ?? "Smartphone",
    productCount,
    createdAt: toIso(category.createdAt),
  };
}

export function serializeProduct(product, categoryName = "") {
  return {
    id: product._id,
    name: product.name,
    brand: product.brand,
    categoryId: product.categoryId ?? "",
    categoryName,
    price: product.price,
    originalPrice: product.originalPrice ?? undefined,
    image: product.image,
    rating: product.rating ?? 0,
    badge: normalizeBadge(product.badge),
    specs: product.specs || undefined,
    stock: product.stock ?? 0,
    createdAt: toIso(product.createdAt),
    updatedAt: toIso(product.updatedAt),
  };
}

export function serializeOrder(order) {
  return {
    id: order._id ?? order.id,
    userId: order.userId,
    email: order.email,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    city: order.city,
    district: order.district,
    ward: order.ward,
    note: order.note ?? "",
    paymentMethod: order.paymentMethod,
    status: order.status,
    items: (order.items ?? []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productImage: item.productImage ?? "",
      brand: item.brand ?? "",
      price: item.price,
      quantity: item.quantity,
    })),
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount ?? 0,
    total: order.total,
    paymentStatus: order.paymentStatus,
    momoRequestId: order.momoRequestId ?? null,
    momoTransactionId: order.momoTransactionId ?? null,
    paidAt: toIso(order.paidAt) ?? null,
    cancelReason: order.cancelReason,
    cancelledBy: order.cancelledBy,
    createdAt: toIso(order.createdAt),
  };
}

export function serializeReview(review) {
  return {
    id: review._id,
    productId: review.productId,
    userId: review.userId,
    username: review.username,
    rating: review.rating,
    comment: review.comment,
    images: review.images ?? [],
    analysisResult: review.analysisResult ?? null,
    createdAt: toIso(review.createdAt),
    updatedAt: toIso(review.updatedAt),
  };
}

function toIso(value) {
  if (!value) return undefined;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function normalizeBadge(value) {
  if (!value) return undefined;

  const normalized = String(value).trim().toLowerCase();
  const badgeMap = {
    "ban chay": "Bán chạy",
    moi: "Mới",
    "gia tot": "Giá tốt",
    "noi bat": "Nổi bật",
    hot: "Nổi bật",
    new: "Mới",
    sale: "Giảm giá",
    trending: "Xu hướng",
    "best seller": "Bán chạy",
    value: "Giá tốt",
  };

  return badgeMap[normalized] ?? value;
}
