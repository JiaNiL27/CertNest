import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/files/service";
import { detectFileType } from "@/lib/files/detect";

const SLUG = /^[0-9A-Za-z]{22}$/;

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });

/**
 * Streams a public badge image. The service role is used only to call
 * resolve_public_image (which checks the share is active, images are allowed
 * and the file is a badge image) and then to read that one object.
 */
export async function servePublicImage(slug: string, key: string): Promise<Response> {
  if (!SLUG.test(slug) || !SLUG.test(key)) return notFound();

  const admin = createAdminClient();
  const { data: path, error } = await admin.rpc("resolve_public_image", {
    p_slug: slug,
    p_key: key,
  });
  if (error || typeof path !== "string" || !path) return notFound();

  const { data: blob } = await admin.storage.from(BUCKET).download(path);
  if (!blob) return notFound();

  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Defense in depth: only ever serve real images, never PDFs.
  const type = detectFileType(bytes);
  if (!type?.isImage) return notFound();

  return new Response(bytes, {
    headers: {
      "Content-Type": type.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
