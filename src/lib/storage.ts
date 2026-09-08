import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase Storage client (Req 15). Uses the service-role key,
// which must never reach the browser — this module is imported only by route
// handlers. Avatars live in a public "avatars" bucket; the DB stores the
// resulting public URL.

const AVATAR_BUCKET = "avatars";

let cached: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new StorageNotConfiguredError();
  }
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return cached;
}

/** Thrown when the Supabase storage env vars are missing. */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super("File storage is not configured.");
    this.name = "StorageNotConfiguredError";
  }
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedImageType(contentType: string): boolean {
  return IMAGE_TYPES.has(contentType);
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

/**
 * Uploads a professional's avatar, replacing any prior file (single current
 * photo, Req 15.3), and returns the public URL. The object key is stable per
 * professional so re-uploads overwrite. A cache-busting query param is appended
 * to the returned URL so the new image shows immediately.
 */
export async function uploadAvatar(
  professionalId: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const client = getStorageClient();
  const key = `${professionalId}.${extensionFor(contentType)}`;

  const { error } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(key, bytes, { contentType, upsert: true });
  if (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(key);
  return `${data.publicUrl}?v=${Date.now()}`;
}
