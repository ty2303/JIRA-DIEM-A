/**
 * AI Sentiment Analysis Service
 *
 * Calls the external aspect-based sentiment analysis API.
 * Detects aspects mentioned in review text and classifies sentiment for each.
 *
 * 11 supported aspects:
 * Battery, Camera, Performance, Display, Design, Packaging,
 * Price, Shop_Service, Shipping, General, Others
 */

const DEFAULT_AI_SERVICE_URL =
	"https://subjective-decrease-courses-knife.trycloudflare.com/predict";

/** Read config lazily so tests can override process.env between calls. */
function getConfig() {
	return {
		url: process.env.AI_SENTIMENT_URL || DEFAULT_AI_SERVICE_URL,
		timeoutMs: Number(process.env.AI_SENTIMENT_TIMEOUT_MS) || 15000,
		maxRetries: Number(process.env.AI_SENTIMENT_MAX_RETRIES ?? 1),
	};
}

/**
 * Valid aspect names returned by the AI model.
 */
export const VALID_ASPECTS = [
	"Battery",
	"Camera",
	"Performance",
	"Display",
	"Design",
	"Packaging",
	"Price",
	"Shop_Service",
	"Shipping",
	"General",
	"Others",
];

/**
 * Vietnamese labels for aspects.
 */
export const ASPECT_LABELS = {
	Battery: "Pin",
	Camera: "Camera",
	Performance: "Hiệu năng",
	Display: "Màn hình",
	Design: "Thiết kế",
	Packaging: "Đóng gói",
	Price: "Giá",
	Shop_Service: "Dịch vụ",
	Shipping: "Vận chuyển",
	General: "Tổng quan",
	Others: "Khác",
};

/**
 * @typedef {Object} AspectScores
 * @property {number} positive
 * @property {number} negative
 * @property {number} neutral
 */

/**
 * @typedef {Object} AspectResult
 * @property {string} aspect
 * @property {'positive'|'negative'|'neutral'} sentiment
 * @property {number} confidence
 * @property {AspectScores} scores
 */

/**
 * @typedef {Object} SentimentAnalysisResult
 * @property {AspectResult[]} aspects
 * @property {'positive'|'negative'|'neutral'} overallSentiment
 * @property {number} overallConfidence
 * @property {string} analyzedAt
 */

/**
 * Analyze sentiment of review text using the external AI service.
 *
 * @param {string} text - Review comment text to analyze
 * @returns {Promise<SentimentAnalysisResult>}
 * @throws {SentimentAnalysisError} On timeout, network failure, or invalid response
 */
export async function analyzeSentiment(text) {
	if (!text || typeof text !== "string" || text.trim().length === 0) {
		throw new SentimentAnalysisError(
			"Text is required for analysis",
			"INVALID_INPUT",
		);
	}

	const config = getConfig();
	let lastError = null;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			const result = await callSentimentApi(text.trim(), config);
			return result;
		} catch (error) {
			lastError = error;

			// Don't retry on validation errors
			if (error.code === "INVALID_INPUT" || error.code === "INVALID_RESPONSE") {
				throw error;
			}

			// Don't retry on last attempt
			if (attempt === config.maxRetries) {
				break;
			}

			// Brief delay before retry (exponential backoff)
			await delay(1000 * (attempt + 1));
		}
	}

	throw lastError;
}

/**
 * Make the actual HTTP call to the sentiment analysis API.
 *
 * @param {string} text
 * @param {{ url: string, timeoutMs: number }} config
 * @returns {Promise<SentimentAnalysisResult>}
 */
async function callSentimentApi(text, config) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

	try {
		const response = await fetch(config.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ text }),
			signal: controller.signal,
		});

		if (!response.ok) {
			const status = response.status;

			if (status === 429) {
				throw new SentimentAnalysisError(
					"AI service rate limit exceeded",
					"RATE_LIMITED",
				);
			}

			if (status >= 500) {
				throw new SentimentAnalysisError(
					`AI service error (HTTP ${status})`,
					"SERVICE_ERROR",
				);
			}

			throw new SentimentAnalysisError(
				`AI service returned HTTP ${status}`,
				"SERVICE_ERROR",
			);
		}

		const data = await response.json();
		return parseApiResponse(data);
	} catch (error) {
		if (error instanceof SentimentAnalysisError) {
			throw error;
		}

		if (error.name === "AbortError") {
			throw new SentimentAnalysisError(
				`AI service timeout after ${config.timeoutMs}ms`,
				"TIMEOUT",
			);
		}

		throw new SentimentAnalysisError(
			`AI service unavailable: ${error.message}`,
			"NETWORK_ERROR",
		);
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Parse and validate the API response into our standard format.
 *
 * Expected input:
 * { "results": [{ "aspect": "General", "sentiment": "positive", "confidence": 0.77, "scores": {...} }] }
 *
 * @param {unknown} data
 * @returns {SentimentAnalysisResult}
 */
function parseApiResponse(data) {
	if (!data || !Array.isArray(data.results) || data.results.length === 0) {
		throw new SentimentAnalysisError(
			"Invalid AI response: missing results array",
			"INVALID_RESPONSE",
		);
	}

	const aspects = data.results
		.filter(
			(item) =>
				item &&
				typeof item.aspect === "string" &&
				typeof item.sentiment === "string" &&
				typeof item.confidence === "number",
		)
		.map((item) => ({
			aspect: item.aspect,
			sentiment: normalizeSentiment(item.sentiment),
			confidence: clamp(item.confidence, 0, 1),
			scores: {
				positive: clamp(item.scores?.positive ?? 0, 0, 1),
				negative: clamp(item.scores?.negative ?? 0, 0, 1),
				neutral: clamp(item.scores?.neutral ?? 0, 0, 1),
			},
		}));

	if (aspects.length === 0) {
		throw new SentimentAnalysisError(
			"Invalid AI response: no valid aspects found",
			"INVALID_RESPONSE",
		);
	}

	// Derive overall sentiment from "General" aspect if present, else highest confidence
	const generalAspect = aspects.find((a) => a.aspect === "General");
	const bestAspect =
		generalAspect ||
		aspects.reduce((best, curr) =>
			curr.confidence > best.confidence ? curr : best,
		);

	return {
		aspects,
		overallSentiment: bestAspect.sentiment,
		overallConfidence: bestAspect.confidence,
		analyzedAt: new Date().toISOString(),
	};
}

/**
 * Normalize sentiment string to valid enum value.
 * @param {string} value
 * @returns {'positive'|'negative'|'neutral'}
 */
function normalizeSentiment(value) {
	const normalized = String(value).toLowerCase().trim();
	if (
		normalized === "positive" ||
		normalized === "negative" ||
		normalized === "neutral"
	) {
		return normalized;
	}
	return "neutral";
}

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
	return Math.min(Math.max(Number(value) || 0, min), max);
}

/**
 * Promise-based delay.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom error class for sentiment analysis failures.
 */
export class SentimentAnalysisError extends Error {
	/**
	 * @param {string} message
	 * @param {'INVALID_INPUT'|'TIMEOUT'|'RATE_LIMITED'|'SERVICE_ERROR'|'NETWORK_ERROR'|'INVALID_RESPONSE'} code
	 */
	constructor(message, code) {
		super(message);
		this.name = "SentimentAnalysisError";
		this.code = code;
	}
}
