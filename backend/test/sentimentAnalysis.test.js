import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	analyzeSentiment,
	SentimentAnalysisError,
	VALID_ASPECTS,
} from "../src/services/sentimentAnalysis.js";

/**
 * Create a mock HTTP server that simulates the AI sentiment API.
 *
 * @param {(req: http.IncomingMessage, res: http.ServerResponse) => void} handler
 * @returns {Promise<{ url: string; close: () => Promise<void> }>}
 */
async function createMockServer(handler) {
	const server = http.createServer(handler);
	await new Promise((resolve) => server.listen(0, resolve));
	const { port } = server.address();
	const url = `http://127.0.0.1:${port}/predict`;

	return {
		url,
		close: () =>
			new Promise((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()));
			}),
	};
}

/**
 * Build a valid API response body with the given aspects.
 */
function buildApiResponse(aspects) {
	return {
		results: aspects.map((a) => ({
			aspect: a.aspect ?? "General",
			sentiment: a.sentiment ?? "positive",
			confidence: a.confidence ?? 0.85,
			scores: {
				positive: a.scores?.positive ?? 0.85,
				negative: a.scores?.negative ?? 0.1,
				neutral: a.scores?.neutral ?? 0.05,
			},
		})),
	};
}

// Save and restore env var between tests
let originalUrl;

beforeEach(() => {
	originalUrl = process.env.AI_SENTIMENT_URL;
});

afterEach(() => {
	if (originalUrl === undefined) {
		delete process.env.AI_SENTIMENT_URL;
	} else {
		process.env.AI_SENTIMENT_URL = originalUrl;
	}
	// Reset retry/timeout to defaults
	delete process.env.AI_SENTIMENT_TIMEOUT_MS;
	delete process.env.AI_SENTIMENT_MAX_RETRIES;
});

describe("sentimentAnalysis service", () => {
	test("analyzes text and returns aspect-based results", async () => {
		const mock = await createMockServer((req, res) => {
			let body = "";
			req.on("data", (chunk) => {
				body += chunk;
			});
			req.on("end", () => {
				const { text } = JSON.parse(body);
				assert.ok(text, "Request should contain text");

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify(
						buildApiResponse([
							{ aspect: "Camera", sentiment: "positive", confidence: 0.92 },
							{ aspect: "Battery", sentiment: "negative", confidence: 0.78 },
							{ aspect: "General", sentiment: "positive", confidence: 0.85 },
						]),
					),
				);
			});
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			const result = await analyzeSentiment("Camera rất tốt, pin hơi yếu");

			assert.equal(result.aspects.length, 3);
			assert.equal(result.overallSentiment, "positive"); // General aspect
			assert.ok(result.overallConfidence > 0);
			assert.ok(result.analyzedAt);

			// Check individual aspects
			const camera = result.aspects.find((a) => a.aspect === "Camera");
			assert.equal(camera.sentiment, "positive");
			assert.ok(camera.confidence > 0);
			assert.ok(camera.scores.positive > 0);

			const battery = result.aspects.find((a) => a.aspect === "Battery");
			assert.equal(battery.sentiment, "negative");
		} finally {
			await mock.close();
		}
	});

	test("rejects empty text input", async () => {
		await assert.rejects(() => analyzeSentiment(""), {
			name: "SentimentAnalysisError",
			code: "INVALID_INPUT",
		});

		await assert.rejects(() => analyzeSentiment("   "), {
			name: "SentimentAnalysisError",
			code: "INVALID_INPUT",
		});

		await assert.rejects(() => analyzeSentiment(null), {
			name: "SentimentAnalysisError",
			code: "INVALID_INPUT",
		});
	});

	test("handles API returning single General aspect", async () => {
		const mock = await createMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify(
					buildApiResponse([
						{ aspect: "General", sentiment: "neutral", confidence: 0.65 },
					]),
				),
			);
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			const result = await analyzeSentiment("xin chào");
			assert.equal(result.aspects.length, 1);
			assert.equal(result.overallSentiment, "neutral");
			assert.equal(result.aspects[0].aspect, "General");
		} finally {
			await mock.close();
		}
	});

	test("handles HTTP 500 as SERVICE_ERROR", async () => {
		process.env.AI_SENTIMENT_MAX_RETRIES = "0"; // no retries for speed

		const mock = await createMockServer((_req, res) => {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Internal Server Error" }));
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			await assert.rejects(() => analyzeSentiment("test"), {
				name: "SentimentAnalysisError",
				code: "SERVICE_ERROR",
			});
		} finally {
			await mock.close();
		}
	});

	test("handles HTTP 429 as RATE_LIMITED", async () => {
		process.env.AI_SENTIMENT_MAX_RETRIES = "0";

		const mock = await createMockServer((_req, res) => {
			res.writeHead(429, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Too many requests" }));
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			await assert.rejects(() => analyzeSentiment("test"), {
				name: "SentimentAnalysisError",
				code: "RATE_LIMITED",
			});
		} finally {
			await mock.close();
		}
	});

	test("handles timeout as TIMEOUT error", async () => {
		process.env.AI_SENTIMENT_TIMEOUT_MS = "500"; // 500ms timeout
		process.env.AI_SENTIMENT_MAX_RETRIES = "0";

		const mock = await createMockServer((_req, res) => {
			// Never respond — let it timeout
			setTimeout(() => {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(buildApiResponse([{ aspect: "General" }])));
			}, 5000);
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			await assert.rejects(() => analyzeSentiment("test"), {
				name: "SentimentAnalysisError",
				code: "TIMEOUT",
			});
		} finally {
			await mock.close();
		}
	});

	test("handles network error as NETWORK_ERROR", async () => {
		process.env.AI_SENTIMENT_URL = "http://127.0.0.1:1/predict"; // nothing listening
		process.env.AI_SENTIMENT_MAX_RETRIES = "0";

		await assert.rejects(() => analyzeSentiment("test"), {
			name: "SentimentAnalysisError",
			code: "NETWORK_ERROR",
		});
	});

	test("handles invalid response (empty results)", async () => {
		const mock = await createMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ results: [] }));
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			await assert.rejects(() => analyzeSentiment("test"), {
				name: "SentimentAnalysisError",
				code: "INVALID_RESPONSE",
			});
		} finally {
			await mock.close();
		}
	});

	test("handles invalid response (missing results field)", async () => {
		const mock = await createMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ data: "wrong" }));
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			await assert.rejects(() => analyzeSentiment("test"), {
				name: "SentimentAnalysisError",
				code: "INVALID_RESPONSE",
			});
		} finally {
			await mock.close();
		}
	});

	test("clamps confidence and score values to 0-1 range", async () => {
		const mock = await createMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					results: [
						{
							aspect: "General",
							sentiment: "positive",
							confidence: 1.5, // should be clamped to 1
							scores: {
								positive: 2.0, // should be clamped to 1
								negative: -0.5, // should be clamped to 0
								neutral: 0.3,
							},
						},
					],
				}),
			);
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			const result = await analyzeSentiment("test");
			assert.equal(result.aspects[0].confidence, 1);
			assert.equal(result.aspects[0].scores.positive, 1);
			assert.equal(result.aspects[0].scores.negative, 0);
			assert.equal(result.aspects[0].scores.neutral, 0.3);
		} finally {
			await mock.close();
		}
	});

	test("falls back to highest confidence when no General aspect", async () => {
		const mock = await createMockServer((_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify(
					buildApiResponse([
						{ aspect: "Camera", sentiment: "positive", confidence: 0.6 },
						{ aspect: "Battery", sentiment: "negative", confidence: 0.95 },
					]),
				),
			);
		});

		process.env.AI_SENTIMENT_URL = mock.url;

		try {
			const result = await analyzeSentiment("test");
			// Should use Battery (highest confidence) as overall
			assert.equal(result.overallSentiment, "negative");
			assert.equal(result.overallConfidence, 0.95);
		} finally {
			await mock.close();
		}
	});

	test("VALID_ASPECTS contains all 11 expected aspects", () => {
		assert.equal(VALID_ASPECTS.length, 11);
		assert.ok(VALID_ASPECTS.includes("Battery"));
		assert.ok(VALID_ASPECTS.includes("Camera"));
		assert.ok(VALID_ASPECTS.includes("Performance"));
		assert.ok(VALID_ASPECTS.includes("Display"));
		assert.ok(VALID_ASPECTS.includes("Design"));
		assert.ok(VALID_ASPECTS.includes("Packaging"));
		assert.ok(VALID_ASPECTS.includes("Price"));
		assert.ok(VALID_ASPECTS.includes("Shop_Service"));
		assert.ok(VALID_ASPECTS.includes("Shipping"));
		assert.ok(VALID_ASPECTS.includes("General"));
		assert.ok(VALID_ASPECTS.includes("Others"));
	});

	test("SentimentAnalysisError has correct name and code", () => {
		const error = new SentimentAnalysisError("test", "TIMEOUT");
		assert.equal(error.name, "SentimentAnalysisError");
		assert.equal(error.code, "TIMEOUT");
		assert.equal(error.message, "test");
		assert.ok(error instanceof Error);
	});
});
