import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FileError,
  MAX_FILE_SIZE,
  getSignedFileUrl,
  uploadCertificateFiles,
  type InputFile,
} from "@/lib/files/service";

const STATUS: Record<FileError["code"], number> = {
  unauthorized: 401,
  not_found: 404,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  invalid_image: 400,
  storage_failed: 500,
};

// Two files plus multipart overhead.
const MAX_REQUEST_SIZE = 2 * MAX_FILE_SIZE + 1024 * 1024;

const noStore = { "Cache-Control": "no-store" };

function errorResponse(e: unknown) {
  if (e instanceof FileError) {
    return NextResponse.json({ error: e.message }, { status: STATUS[e.code], headers: noStore });
  }
  console.error("[files] unexpected error", e instanceof Error ? e.name : typeof e);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500, headers: noStore },
  );
}

async function readFile(value: FormDataEntryValue | null): Promise<InputFile | undefined> {
  if (!value || typeof value === "string" || value.size === 0) return undefined;
  if (value.size > MAX_FILE_SIZE) throw new FileError("too_large");
  return { bytes: new Uint8Array(await value.arrayBuffer()), name: value.name };
}

// Upload: multipart form with certificate_id, and optional original / badge.
export async function POST(request: NextRequest) {
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_REQUEST_SIZE) throw new FileError("too_large");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new FileError("unauthorized");

    const form = await request.formData();
    const certificateId = String(form.get("certificate_id") ?? "");
    const original = await readFile(form.get("original"));
    const badge = await readFile(form.get("badge"));
    if (!original && !badge) throw new FileError("empty", "Choose a file to upload.");

    await uploadCertificateFiles(supabase, certificateId, { original, badge });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

// Owner-only access: ?id=<file id>[&view=1]. Redirects to a 60 s signed URL.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new FileError("not_found");

    const params = request.nextUrl.searchParams;
    const url = await getSignedFileUrl(
      supabase,
      params.get("id") ?? "",
      params.get("view") === "1" ? "view" : "download",
    );
    return NextResponse.redirect(url, { status: 303, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
