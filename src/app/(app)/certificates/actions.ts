"use server";

import { redirect } from "next/navigation";
import { fieldSources, parseCertificateForm } from "@/lib/certificates/schema";
import { setCertificateSkills } from "@/lib/certificates/skills";
import { FileError, deleteCertificate, deleteCertificateFile } from "@/lib/files/service";
import { createClient } from "@/lib/supabase/server";

export type SaveResult =
  | { ok: true; id: string; warning?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Creates (certificateId = null) or updates a certificate. Files are uploaded
 * separately through /api/files, so this action only receives text fields.
 */
export async function saveCertificate(
  certificateId: string | null,
  formData: FormData,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parseCertificateForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const { skills, ...fields } = parsed.data;
  const row = { ...fields, field_sources: fieldSources(parsed.data) };

  let id = certificateId;
  if (id === null) {
    const { data, error } = await supabase
      .from("certificates")
      .insert({ ...row, user_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[certificates] insert failed", error?.code);
      return { ok: false, error: GENERIC_ERROR };
    }
    id = data.id as string;
  } else {
    const { data, error } = await supabase
      .from("certificates")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) {
      console.error("[certificates] update failed", error.code);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!data.length) return { ok: false, error: "Certificate not found." };
  }

  try {
    await setCertificateSkills(supabase, id, skills);
  } catch (e) {
    console.error("[certificates] skills failed", (e as { code?: string }).code);
    return { ok: true, id, warning: "Saved, but your skills could not be updated." };
  }
  return { ok: true, id };
}

export async function deleteCertificateAction(certificateId: string) {
  const supabase = await createClient();
  try {
    await deleteCertificate(supabase, certificateId);
  } catch (e) {
    return { error: e instanceof FileError ? e.message : GENERIC_ERROR };
  }
  redirect("/certificates");
}

export async function deleteFileAction(fileId: string) {
  const supabase = await createClient();
  try {
    await deleteCertificateFile(supabase, fileId);
    return {};
  } catch (e) {
    return { error: e instanceof FileError ? e.message : GENERIC_ERROR };
  }
}
