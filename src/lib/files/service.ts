import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomBase62 } from "@/lib/random";
import { detectFileType, type DetectedFile } from "./detect";
import { sanitizeImage } from "./sanitize";

// All functions take the caller's own Supabase client, so storage and table
// access is limited by RLS. No service role here.

export const BUCKET = "certificate-files";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type FileKind = "original" | "badge_image";
export type InputFile = { bytes: Uint8Array; name: string };

type FileErrorCode =
  | "unauthorized"
  | "not_found"
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "invalid_image"
  | "storage_failed";

const MESSAGES: Record<FileErrorCode, string> = {
  unauthorized: "Please sign in again.",
  not_found: "Not found.",
  empty: "The file is empty.",
  too_large: "Files must be 10 MB or smaller.",
  unsupported_type: "Only PDF, PNG, JPEG and WebP files are supported.",
  invalid_image: "This image could not be processed. Please try another file.",
  storage_failed: "The file could not be saved. Please try again.",
};

export class FileError extends Error {
  constructor(
    public code: FileErrorCode,
    message = MESSAGES[code],
  ) {
    super(message);
  }
}

const uuid = z.uuid();

async function requireUserId(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new FileError("unauthorized");
  return user.id;
}

// Missing and not-owned are indistinguishable on purpose.
async function requireOwnedCertificate(supabase: SupabaseClient, certificateId: string) {
  if (!uuid.safeParse(certificateId).success) throw new FileError("not_found");
  const { data } = await supabase
    .from("certificates")
    .select("id")
    .eq("id", certificateId)
    .maybeSingle();
  if (!data) throw new FileError("not_found");
}

type PreparedFile = { bytes: Uint8Array; type: DetectedFile };

async function prepareFile(input: InputFile, kind: FileKind): Promise<PreparedFile> {
  if (input.bytes.length === 0) throw new FileError("empty");
  if (input.bytes.length > MAX_FILE_SIZE) throw new FileError("too_large");

  const type = detectFileType(input.bytes);
  if (!type) throw new FileError("unsupported_type");
  if (kind === "badge_image" && !type.isImage) {
    throw new FileError("unsupported_type", "Badge images must be PNG, JPEG or WebP.");
  }
  if (!type.isImage) return { bytes: input.bytes, type };

  let bytes: Uint8Array;
  try {
    bytes = await sanitizeImage(input.bytes, type);
  } catch {
    throw new FileError("invalid_image");
  }
  if (bytes.length > MAX_FILE_SIZE) throw new FileError("too_large");
  return { bytes, type };
}

// Display name for downloads: no path parts or control chars, real extension.
export function cleanFileName(name: string, ext: string) {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\.[^.]*$/, "")
    .trim()
    .slice(0, 150);
  return `${base || "certificate"}.${ext}`;
}

async function storeFile(
  supabase: SupabaseClient,
  userId: string,
  certificateId: string,
  kind: FileKind,
  file: PreparedFile,
  name: string,
) {
  const path = `${userId}/${certificateId}/${randomUUID()}.${file.type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: file.type.mime, upsert: false });
  if (uploadError) throw new FileError("storage_failed");

  const { data, error } = await supabase
    .from("certificate_files")
    .insert({
      certificate_id: certificateId,
      user_id: userId,
      kind,
      storage_path: path,
      file_name: cleanFileName(name, file.type.ext),
      mime_type: file.type.mime,
      file_size: file.bytes.length,
      public_key: randomBase62(),
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new FileError("storage_failed");
  }
  return data.id as string;
}

// Removes every other file of this kind (and its storage object).
async function removeOlderFiles(
  supabase: SupabaseClient,
  certificateId: string,
  kind: FileKind,
  keepId: string,
) {
  const { data: old } = await supabase
    .from("certificate_files")
    .select("id, storage_path")
    .eq("certificate_id", certificateId)
    .eq("kind", kind)
    .neq("id", keepId);
  if (!old?.length) return;

  const { error } = await supabase.storage.from(BUCKET).remove(old.map((f) => f.storage_path));
  // If storage removal fails, keep the rows so the objects stay tracked.
  if (error) return;
  await supabase
    .from("certificate_files")
    .delete()
    .in(
      "id",
      old.map((f) => f.id),
    );
}

async function hasFileOfKind(supabase: SupabaseClient, certificateId: string, kind: FileKind) {
  const { count } = await supabase
    .from("certificate_files")
    .select("id", { count: "exact", head: true })
    .eq("certificate_id", certificateId)
    .eq("kind", kind);
  return (count ?? 0) > 0;
}

/**
 * Uploads an original file and/or a badge image, replacing existing ones.
 * If the original is an image and the certificate has no badge image, a
 * separate copy is stored as the badge image (the original stays private).
 */
export async function uploadCertificateFiles(
  supabase: SupabaseClient,
  certificateId: string,
  files: { original?: InputFile; badge?: InputFile },
) {
  const userId = await requireUserId(supabase);
  await requireOwnedCertificate(supabase, certificateId);

  // Validate everything before storing anything.
  const original = files.original && (await prepareFile(files.original, "original"));
  const badge = files.badge && (await prepareFile(files.badge, "badge_image"));

  if (badge) {
    const id = await storeFile(supabase, userId, certificateId, "badge_image", badge, files.badge!.name);
    await removeOlderFiles(supabase, certificateId, "badge_image", id);
  }

  if (original) {
    const id = await storeFile(supabase, userId, certificateId, "original", original, files.original!.name);
    await removeOlderFiles(supabase, certificateId, "original", id);

    if (
      original.type.isImage &&
      !badge &&
      !(await hasFileOfKind(supabase, certificateId, "badge_image"))
    ) {
      await storeFile(
        supabase,
        userId,
        certificateId,
        "badge_image",
        original,
        `badge.${original.type.ext}`,
      );
    }
  }
}

export async function deleteCertificateFile(supabase: SupabaseClient, fileId: string) {
  if (!uuid.safeParse(fileId).success) throw new FileError("not_found");
  const { data } = await supabase
    .from("certificate_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (!data) throw new FileError("not_found");

  const { error } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
  if (error) throw new FileError("storage_failed");
  await supabase.from("certificate_files").delete().eq("id", fileId);
}

/** Short-lived (60 s) signed URL for the owner. */
export async function getSignedFileUrl(
  supabase: SupabaseClient,
  fileId: string,
  mode: "download" | "view",
) {
  if (!uuid.safeParse(fileId).success) throw new FileError("not_found");
  const { data: file } = await supabase
    .from("certificate_files")
    .select("storage_path, file_name, mime_type")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) throw new FileError("not_found");
  // Inline viewing is only for images; PDFs are always downloaded.
  if (mode === "view" && file.mime_type === "application/pdf") throw new FileError("not_found");

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      file.storage_path,
      60,
      mode === "download" ? { download: file.file_name } : undefined,
    );
  if (error || !data) throw new FileError("not_found");
  return data.signedUrl;
}

/** Deletes storage objects first, then the certificate row (files cascade). */
export async function deleteCertificate(supabase: SupabaseClient, certificateId: string) {
  const userId = await requireUserId(supabase);
  await requireOwnedCertificate(supabase, certificateId);

  const bucket = supabase.storage.from(BUCKET);
  const { data: rows } = await supabase
    .from("certificate_files")
    .select("storage_path")
    .eq("certificate_id", certificateId);
  // Also sweep any untracked objects left in this certificate's folder.
  const { data: listed } = await bucket.list(`${userId}/${certificateId}`);
  const paths = new Set([
    ...(rows ?? []).map((r) => r.storage_path as string),
    ...(listed ?? []).map((o) => `${userId}/${certificateId}/${o.name}`),
  ]);

  if (paths.size) {
    const { error } = await bucket.remove([...paths]);
    if (error) throw new FileError("storage_failed");
  }

  const { data: deleted, error } = await supabase
    .from("certificates")
    .delete()
    .eq("id", certificateId)
    .select("id");
  if (error || !deleted?.length) throw new FileError("not_found");
}
