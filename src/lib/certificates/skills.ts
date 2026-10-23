import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Replaces a certificate's skills with the given names (via ensure_skills). */
export async function setCertificateSkills(
  supabase: SupabaseClient,
  certificateId: string,
  names: string[],
) {
  let skillIds: string[] = [];
  if (names.length) {
    const { data, error } = await supabase.rpc("ensure_skills", { names });
    if (error) throw error;
    skillIds = (data as { id: string }[]).map((s) => s.id);
  }

  let remove = supabase.from("certificate_skills").delete().eq("certificate_id", certificateId);
  if (skillIds.length) remove = remove.not("skill_id", "in", `(${skillIds.join(",")})`);
  const { error: deleteError } = await remove;
  if (deleteError) throw deleteError;

  if (skillIds.length) {
    const { error } = await supabase
      .from("certificate_skills")
      .upsert(
        skillIds.map((skill_id) => ({ certificate_id: certificateId, skill_id })),
        { onConflict: "certificate_id,skill_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
}
