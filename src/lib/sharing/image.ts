import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/files/service";
import { detectFileType } from "@/lib/files/detect";

const SLUG = /^[0-9A-Za-z]{22}$/;
const KEY = /^[0-9A-Za-z]{22}$/;
const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });

/**
 * Streams a public badge image. The service role is used only to call a
 * resolve_public_image* function (which checks the share is active, images
 * are allowed and the file is a badge image) and then to read that one object.
 */
async function serve(rpc: string, args: Record<string, string>): Promise<Response> {
  const admin = createAdminClient();
  const { data: path, error } = await admin.rpc(rpc, args);
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

export function servePublicImage(slug: string, key: string) {
  if (!SLUG.test(slug) || !KEY.test(key)) return Promise.resolve(notFound());
  return serve("resolve_public_image", { p_slug: slug, p_key: key });
}

export function servePublicImageByHandle(handle: string, key: string) {
  if (!HANDLE.test(handle) || !KEY.test(key)) return Promise.resolve(notFound());
  return serve("resolve_public_image_by_handle", { p_handle: handle, p_key: key });
}
