import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, test } from "node:test";
import { app } from "../src/app.js";
import { db } from "../src/data/store.js";

async function withServer(run) {
  const server = http.createServer(app);
  server.listen(0);
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

function createLargeImageDataUrl(size = 160_000) {
  return `data:image/png;base64,${"A".repeat(size)}`;
}

const baselineReviews = db.reviews.map((review) => ({ ...review }));
const baselineProducts = db.products.map((product) => ({ ...product }));

afterEach(() => {
  db.reviews = baselineReviews.map((review) => ({ ...review }));
  db.products = baselineProducts.map((product) => ({ ...product }));
});

describe("Review image upload", () => {
  test("POST /api/reviews/upload-image accepts payloads above the default JSON limit", async () => {
    await withServer(async (port) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/reviews/upload-image`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer demo-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageData: createLargeImageDataUrl(),
            folder: "ignored-folder",
          }),
        },
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.match(String(body.data), /^data:image\/png;base64,/);
    });
  });

  test("POST /api/reviews rejects invalid image strings in review payloads", async () => {
    await withServer(async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/reviews`, {
        method: "POST",
        headers: {
          Authorization: "Bearer demo-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: "prod-out-of-stock",
          rating: 5,
          comment: "Anh review hop le",
          images: ["javascript:alert('xss')"],
        }),
      });

      assert.equal(response.status, 400);
    });
  });

  test("POST /api/products/:id/reviews accepts large inline review images", async () => {
    await withServer(async (port) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/products/prod-out-of-stock/reviews`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer demo-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rating: 4,
            comment: "Review co anh lon van duoc luu",
            images: [createLargeImageDataUrl()],
          }),
        },
      );
      const body = await response.json();

      assert.equal(response.status, 201);
      assert.equal(body.data.productId, "prod-out-of-stock");
      assert.equal(body.data.images.length, 1);
      assert.match(String(body.data.images[0]), /^data:image\/png;base64,/);
    });
  });
});
