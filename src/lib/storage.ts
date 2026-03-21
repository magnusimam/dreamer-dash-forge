const CLOUD_NAME = "dckgjhlsq";
const UPLOAD_PRESET = "dreamer_dash";

export async function uploadImage(
  folder: "hackathon-covers" | "activity-proofs",
  file: File,
  userId: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", `dreamer-dash/${folder}`);
  formData.append("public_id", `${userId}_${Date.now()}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Image upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
