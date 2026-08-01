import { supabase } from "./supabase";
import { getInitData } from "./telegram";

const CLOUD_NAME = "dckgjhlsq";

/**
 * Upload an image to Cloudinary using a SIGNED upload.
 * The signature (and the folder/public_id) are produced server-side by the
 * `cloudinary-sign` edge function, which verifies the Telegram user — so the
 * Cloudinary API secret never reaches the client and anonymous callers can't
 * abuse the account. The third arg is kept for call-site compatibility but is
 * unused (identity comes from the verified initData).
 */
export async function uploadImage(
  folder: string,
  file: File,
  _userId?: string
): Promise<string> {
  const { data: sig, error: sigErr } = await supabase.functions.invoke("cloudinary-sign", {
    body: { initData: getInitData(), folder },
  });

  if (sigErr || !sig?.signature) {
    throw new Error("Upload authorization failed — please try again");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sig.api_key);
  formData.append("timestamp", String(sig.timestamp));
  formData.append("signature", sig.signature);
  formData.append("folder", sig.folder);
  formData.append("public_id", sig.public_id);

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
