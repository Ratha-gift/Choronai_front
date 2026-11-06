/** Folders of the image bucket (Cloudflare R2, see the backend README). */
export type ImageFolder =
  "products" | "business-images" | "business-branch-images" | "user-profile";

/**
 * Uploads an image (a File or a data URL from readImage) to the Laravel API,
 * which stores it in R2, and returns the address to show it from.
 * Throws when the API cannot be reached or refuses the file; callers then
 * keep the data URL so the app still works offline.
 */
export async function uploadImage(
  image: File | Blob | string,
  folder: ImageFolder,
) {
  const blob =
    typeof image === "string" ? await (await fetch(image)).blob() : image;
  const type = blob.type || "image/jpeg";
  const extension = type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const body = new FormData();
  body.set("folder", folder);
  body.set(
    "image",
    blob,
    image instanceof File ? image.name : `image.${extension}`,
  );
  const response = await fetch("/api/backend/uploads/images", {
    method: "POST",
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.url !== "string")
    throw new Error(result.message || `Upload failed (${response.status})`);
  // A public bucket gives a full URL; otherwise the image comes through the API.
  return /^https?:\/\//.test(result.url)
    ? result.url
    : `/api/backend/${result.url}`;
}

/** Uploads, or keeps the data URL when the API is unavailable (offline). */
export async function uploadOrKeep(dataUrl: string, folder: ImageFolder) {
  try {
    return { url: await uploadImage(dataUrl, folder), uploaded: true };
  } catch {
    return { url: dataUrl, uploaded: false };
  }
}
