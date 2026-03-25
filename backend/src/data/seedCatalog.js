import { db } from "./store.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";

let hasSeededCatalog = false;

export async function seedCatalogIfNeeded() {
  if (hasSeededCatalog) {
    return;
  }

  const [categoryCount, productCount, reviewCount] = await Promise.all([
    Category.countDocuments(),
    Product.countDocuments(),
    Review.countDocuments()
  ]);

  const operations = [];

  if (categoryCount === 0) {
    operations.push(
      Category.insertMany(
        db.categories.map((category) => ({
          _id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          icon: category.icon ?? "Smartphone",
          createdAt: category.createdAt ?? new Date()
        }))
      )
    );
  }

  if (productCount === 0) {
    operations.push(
      Product.insertMany(
        db.products.map((product) => ({
          _id: product.id,
          name: product.name,
          brand: product.brand,
          categoryId: product.categoryId,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          rating: product.rating ?? 0,
          badge: product.badge ?? "",
          specs: product.specs ?? "",
          stock: product.stock ?? 0,
          createdAt: product.createdAt ?? new Date(),
          updatedAt: product.updatedAt ?? new Date()
        }))
      )
    );
  }

  if (reviewCount === 0) {
    operations.push(
      Review.insertMany(
        db.reviews.map((review) => ({
          _id: review.id,
          productId: review.productId,
          userId: review.userId,
          username: review.username,
          rating: review.rating,
          comment: review.comment,
          images: review.images ?? [],
          createdAt: review.createdAt ?? new Date(),
          updatedAt: review.updatedAt ?? review.createdAt ?? new Date()
        }))
      )
    );
  }

  if (operations.length > 0) {
    await Promise.all(operations);
  }

  hasSeededCatalog = true;
}
