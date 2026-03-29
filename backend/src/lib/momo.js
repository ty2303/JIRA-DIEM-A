import crypto from "node:crypto";

const DEFAULT_REQUEST_TYPE = "captureWallet";
const DEFAULT_LANG = "vi";

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export class MomoConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "MomoConfigError";
    this.status = 503;
  }
}

export class MomoGatewayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "MomoGatewayError";
    this.status = status;
  }
}

export function getMomoConfig() {
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim() ?? "";
  const backendUrl = process.env.BACKEND_URL?.trim() ?? "";

  const config = {
    apiUrl: process.env.MOMO_API_URL?.trim() ?? "",
    partnerCode: process.env.MOMO_PARTNER_CODE?.trim() ?? "",
    accessKey: process.env.MOMO_ACCESS_KEY?.trim() ?? "",
    secretKey: process.env.MOMO_SECRET_KEY?.trim() ?? "",
    redirectUrl:
      process.env.MOMO_REDIRECT_URL?.trim() ||
      (frontendUrl ? `${frontendUrl}/checkout/success` : ""),
    ipnUrl:
      process.env.MOMO_IPN_URL?.trim() ||
      (backendUrl ? `${backendUrl}/api/orders/momo/ipn` : ""),
    requestType: process.env.MOMO_REQUEST_TYPE?.trim() || DEFAULT_REQUEST_TYPE,
    lang: process.env.MOMO_LANG?.trim() || DEFAULT_LANG,
  };

  if (
    !config.apiUrl ||
    !config.partnerCode ||
    !config.accessKey ||
    !config.secretKey ||
    !config.redirectUrl ||
    !config.ipnUrl
  ) {
    throw new MomoConfigError(
      "MoMo chưa được cấu hình đầy đủ (thiếu MOMO_API_URL, MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_REDIRECT_URL hoặc MOMO_IPN_URL)",
    );
  }

  return config;
}

function buildCreateSignaturePayload(payload) {
  return [
    `accessKey=${payload.accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData}`,
    `ipnUrl=${payload.ipnUrl}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `partnerCode=${payload.partnerCode}`,
    `redirectUrl=${payload.redirectUrl}`,
    `requestId=${payload.requestId}`,
    `requestType=${payload.requestType}`,
  ].join("&");
}

function buildCallbackSignaturePayload(payload, accessKey) {
  return [
    `accessKey=${accessKey}`,
    `amount=${payload.amount ?? ""}`,
    `extraData=${payload.extraData ?? ""}`,
    `message=${payload.message ?? ""}`,
    `orderId=${payload.orderId ?? ""}`,
    `orderInfo=${payload.orderInfo ?? ""}`,
    `orderType=${payload.orderType ?? ""}`,
    `partnerCode=${payload.partnerCode ?? ""}`,
    `payType=${payload.payType ?? ""}`,
    `requestId=${payload.requestId ?? ""}`,
    `responseTime=${payload.responseTime ?? ""}`,
    `resultCode=${payload.resultCode ?? ""}`,
    `transId=${payload.transId ?? ""}`,
  ].join("&");
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function createMomoPayment({ amount, extraData = "", orderId, orderInfo, redirectUrl }) {
  const config = getMomoConfig();
  const requestId = `momo-${crypto.randomUUID()}`;

  const requestBody = {
    partnerCode: config.partnerCode,
    accessKey: config.accessKey,
    requestId,
    amount: String(amount),
    orderId,
    orderInfo,
    redirectUrl: redirectUrl?.trim() || config.redirectUrl,
    ipnUrl: config.ipnUrl,
    requestType: config.requestType,
    extraData,
    lang: config.lang,
  };

  requestBody.signature = crypto
    .createHmac("sha256", config.secretKey)
    .update(buildCreateSignaturePayload(requestBody))
    .digest("hex");

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new MomoGatewayError(payload?.message || "MoMo trả về lỗi khi khởi tạo thanh toán");
  }

  if (payload?.resultCode !== 0) {
    throw new MomoGatewayError(payload?.message || "Khởi tạo thanh toán MoMo thất bại");
  }

  const payUrl = payload.payUrl ?? null;

  if (!payUrl || !isValidHttpUrl(payUrl)) {
    throw new MomoGatewayError("MoMo không trả về đường dẫn thanh toán hợp lệ");
  }

  return {
    partnerCode: payload.partnerCode ?? config.partnerCode,
    requestId: payload.requestId ?? requestId,
    orderId: payload.orderId ?? orderId,
    amount: payload.amount ?? requestBody.amount,
    resultCode: payload.resultCode,
    message: payload.message ?? "Success",
    payUrl,
    paymentUrl: payUrl,
    deeplink: payload.deeplink ?? null,
    qrCodeUrl: payload.qrCodeUrl ?? null,
    deeplinkMiniApp: payload.deeplinkMiniApp ?? null,
    responseTime: payload.responseTime ?? null,
    signature: payload.signature ?? null,
  };
}

export function verifyMomoCallbackSignature(payload) {
  const config = getMomoConfig();
  const signature = payload?.signature;

  if (!signature || typeof signature !== "string") {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", config.secretKey)
    .update(buildCallbackSignaturePayload(payload, config.accessKey))
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}
