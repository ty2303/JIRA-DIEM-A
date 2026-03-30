const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function uploadReviewImage(imageData, folder = "reviews") {
  const normalized = String(imageData ?? "").trim();
  assertValidReviewImageData(normalized);

  if (hasCloudinaryConfig()) {
    return uploadToCloudinary(normalized, folder);
  }

  return normalized;
}

export function isUploadableReviewImageData(value) {
  try {
    assertValidReviewImageData(value);
    return true;
  } catch {
    return false;
  }
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_UPLOAD_PRESET
  );
}

async function uploadToCloudinary(imageData, folder) {
  const formData = new FormData();
  formData.append("file", imageData);
  formData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Khong the upload anh len Cloudinary");
  }

  const payload = await response.json();
  return String(payload?.secure_url ?? "").trim();
}

function estimateBase64Bytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = (base64.match(/=*$/)?.[0]?.length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
}

function assertValidReviewImageData(value) {
  const parsedImage = parseImageDataUrl(value);

  if (!parsedImage) {
    throw new Error("Anh review khong hop le");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(parsedImage.mimeType)) {
    throw new Error("Dinh dang anh review khong duoc ho tro");
  }

  const sizeInBytes = estimateBase64Bytes(value);
  if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Anh danh gia phai nho hon 2MB");
  }
}

function parseImageDataUrl(value) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    value,
  );

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2],
  };
}
