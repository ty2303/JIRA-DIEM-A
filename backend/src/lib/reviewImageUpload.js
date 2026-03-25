const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export async function uploadReviewImage(imageData, folder = "reviews") {
  const normalized = String(imageData ?? "").trim();

  if (!normalized.startsWith("data:image/")) {
    throw new Error("Anh review khong hop le");
  }

  const sizeInBytes = estimateBase64Bytes(normalized);
  if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Anh danh gia phai nho hon 2MB");
  }

  if (hasCloudinaryConfig()) {
    return uploadToCloudinary(normalized, folder);
  }

  return normalized;
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
