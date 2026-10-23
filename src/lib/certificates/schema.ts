import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use the date picker.")
  .transform((v) => (v === "" ? null : v));

export const MAX_SKILLS = 30;

export const certificateInput = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    issuer_name: z.string().trim().min(1, "Issuing organization is required.").max(200),
    source_platform: optionalText(200),
    description: optionalText(5000),
    credential_id: optionalText(200),
    credential_url: optionalText(2000).refine(
      (v) => v === null || /^https?:\/\/[^\s]+$/i.test(v),
      "Credential URL must start with http:// or https://.",
    ),
    issued_at: optionalDate,
    expiration_status: z.enum(["has_date", "never", "unknown"]),
    expires_at: optionalDate,
    skills: z
      .string()
      .max(3000)
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .refine((list) => list.length <= MAX_SKILLS, `Add at most ${MAX_SKILLS} skills.`)
      .refine((list) => list.every((s) => s.length <= 60), "Each skill must be 60 characters or fewer."),
    hidden_from_portfolio: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .transform((v) => ({
    ...v,
    // Only keep a date when the status says there is one.
    expires_at: v.expiration_status === "has_date" ? v.expires_at : null,
  }))
  .refine((v) => v.expiration_status !== "has_date" || v.expires_at !== null, {
    message: "Add an expiration date, or choose another expiration option.",
    path: ["expires_at"],
  })
  .refine((v) => !v.expires_at || !v.issued_at || v.expires_at >= v.issued_at, {
    message: "Expiration date can't be earlier than the issue date.",
    path: ["expires_at"],
  });

export type CertificateInput = z.infer<typeof certificateInput>;

export function parseCertificateForm(formData: FormData) {
  const raw = Object.fromEntries(
    [
      "title",
      "issuer_name",
      "source_platform",
      "description",
      "credential_id",
      "credential_url",
      "issued_at",
      "expiration_status",
      "expires_at",
      "skills",
      "hidden_from_portfolio",
    ].map((k) => [k, formData.get(k) ?? undefined]),
  );
  return certificateInput.safeParse({
    ...raw,
    source_platform: raw.source_platform ?? "",
    description: raw.description ?? "",
    credential_id: raw.credential_id ?? "",
    credential_url: raw.credential_url ?? "",
    issued_at: raw.issued_at ?? "",
    expires_at: raw.expires_at ?? "",
    skills: raw.skills ?? "",
  });
}

// Fields the user typed in themselves (reserved for future auto-extraction).
export function fieldSources(input: CertificateInput) {
  const keys = [
    "title",
    "issuer_name",
    "source_platform",
    "description",
    "credential_id",
    "credential_url",
    "issued_at",
    "expires_at",
  ] as const;
  return Object.fromEntries(keys.filter((k) => input[k] !== null).map((k) => [k, "user"]));
}
