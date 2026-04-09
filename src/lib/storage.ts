const CLOUD_NAME = "dckgjhlsq";
const UPLOAD_PRESET = "dreamer_dash";

export async function uploadImage(
  folder: string,
  file: File,
  userId: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", `dreamer-dash/${folder}`);
  formData.append("public_id", `${userId}_${Date.now()}`);

  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );
  } catch (e) {
    throw new Error("Network error — check your internet connection and try again");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Image upload failed — please try again");
  }

  const data = await res.json();
  return data.secure_url;
}
