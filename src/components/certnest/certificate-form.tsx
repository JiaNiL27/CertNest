"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Sparkles, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCertificate, deleteFileAction } from "@/app/(app)/certificates/actions";
import { getAiRemaining } from "@/app/(app)/certificates/ai-actions";
import type { CertificateDetail, CertificateFile } from "@/lib/certificates/queries";
import type { DraftedFields } from "@/lib/ai/draft-fields";
import type { ExtractedFields } from "@/lib/ai/extract";
import { formatFileSize } from "@/lib/format";
import { DeleteCertificateDialog } from "./delete-certificate-dialog";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Errors = Record<string, string>;

function FieldError({ errors, name }: { errors: Errors; name: string }) {
  if (!errors[name]) return null;
  return (
    <p id={`${name}-error`} className="text-sm text-destructive">
      {errors[name]}
    </p>
  );
}

// "suggested": read from the user's file. "generated": written by AI from the
// title and issuer, so it isn't from the certificate at all.
type AiNote = "suggested" | "generated";

function AiTag({ name, note }: { name: string; note: AiNote }) {
  return (
    <p
      id={`${name}-ai`}
      className={`flex items-center gap-1 text-xs font-medium ${
        note === "generated" ? "text-amber-700 dark:text-amber-400" : "text-primary"
      }`}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {note === "generated"
        ? "Written by AI, not from your certificate"
        : "Suggested by AI, please check"}
    </p>
  );
}

function Field({
  name,
  label,
  hint,
  errors,
  ai,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors: Errors;
  ai?: AiNote;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {ai && <AiTag name={name} note={ai} />}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError errors={errors} name={name} />
    </div>
  );
}

// A file already saved on the certificate: download it, or remove it for good.
function ExistingFile({ file, onRemoved }: { file: CertificateFile; onRemoved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  function remove() {
    if (!window.confirm(`Remove "${file.file_name}"? This deletes the file and can't be undone.`)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteFileAction(file.id);
      if (result.error) return setError(result.error);
      setRemoved(true);
      onRemoved();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {file.file_name}{" "}
        <span className="text-muted-foreground">({formatFileSize(file.file_size)})</span>
      </span>
      <a
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        href={`/api/files?id=${file.id}`}
      >
        <Download aria-hidden /> Download
      </a>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={remove}
        aria-label={`Remove ${file.file_name}`}
      >
        <Trash2 aria-hidden /> {pending ? "Removing…" : "Remove"}
      </Button>
      {error && <p className="w-full text-destructive">{error}</p>}
    </div>
  );
}

// File input that shows the chosen file and lets you clear it before saving.
// The native input keeps the file, so it's still sent with the form.
function FilePicker({
  id,
  accept,
  label,
  onFileChange,
}: {
  id: string;
  accept: string;
  label: string;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosenState] = useState<File | null>(null);
  const setChosen = (file: File | null) => {
    setChosenState(file);
    onFileChange?.(file);
  };

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setChosen(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        ref={inputRef}
        id={id}
        name={id}
        type="file"
        accept={accept}
        onChange={(e) => setChosen(e.currentTarget.files?.[0] ?? null)}
        className={chosen ? "sr-only" : undefined}
      />
      {chosen && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {chosen.name}{" "}
            <span className="text-muted-foreground">
              ({formatFileSize(chosen.size)}, uploads when you save)
            </span>
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={clear}
            aria-label={`Clear selected ${label.toLowerCase()}`}
          >
            <X aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

export function CertificateForm({ certificate }: { certificate?: CertificateDetail }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [status, setStatus] = useState(certificate?.expiration_status ?? "unknown");
  const [deleteOpen, setDeleteOpen] = useState(false);
  // "Fill from file": the chosen original, fields still holding AI values,
  // and the expiration date input's value/remount key (it's uncontrolled).
  const [original, setOriginal] = useState<File | null>(null);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [filling, setFilling] = useState(false);
  const [fillMessage, setFillMessage] = useState<{ ok: boolean; text: string }>();
  const [expiresValue, setExpiresValue] = useState(certificate?.expires_at ?? "");
  const [expiresKey, setExpiresKey] = useState(0);
  // "Suggest with AI": fields drafted from the title/issuer, and the form
  // values that decide whether the button can be used.
  const [aiGenerated, setAiGenerated] = useState<Set<string>>(new Set());
  const [drafting, setDrafting] = useState(false);
  const [draftMessage, setDraftMessage] = useState<{ ok: boolean; text: string }>();
  const [snap, setSnap] = useState(() => ({
    hasTitle: !!certificate?.title,
    hasIssuer: !!certificate?.issuer_name,
    descriptionEmpty: !certificate?.description,
    skillsEmpty: !certificate?.skills.length,
  }));

  // Shared hourly AI limit; null until loaded (or if it can't be read).
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  useEffect(() => {
    getAiRemaining().then(setAiRemaining, () => undefined);
  }, []);
  const updateRemaining = (res: Response) => {
    const n = Number.parseInt(res.headers.get("X-AI-Remaining") ?? "", 10);
    if (!Number.isNaN(n)) setAiRemaining(n);
  };
  const remainingNote =
    aiRemaining === null ? null : (
      <p className="text-xs text-muted-foreground">{aiRemaining} of 10 AI requests left this hour</p>
    );

  const isEdit = !!certificate;

  const aiNote = (name: string): AiNote | undefined =>
    aiGenerated.has(name) ? "generated" : aiFields.has(name) ? "suggested" : undefined;

  const valueOf = (name: string) => {
    const el = formRef.current?.elements.namedItem(name);
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value.trim() : "";
  };

  function refreshSnap() {
    setSnap({
      hasTitle: !!valueOf("title"),
      hasIssuer: !!valueOf("issuer_name"),
      descriptionEmpty: !valueOf("description"),
      skillsEmpty: !valueOf("skills"),
    });
  }

  async function suggestWithAi() {
    const form = formRef.current;
    if (!form) return;
    const want = [
      ...(valueOf("description") ? [] : ["description"]),
      ...(valueOf("skills") ? [] : ["skills"]),
    ];
    if (!want.length) return;
    setDrafting(true);
    setDraftMessage(undefined);
    try {
      const res = await fetch("/api/ai/draft-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: valueOf("title"),
          issuer_name: valueOf("issuer_name"),
          source_platform: valueOf("source_platform"),
          want,
        }),
      });
      updateRemaining(res);
      const data = (await res.json().catch(() => ({}))) as { fields?: DraftedFields; error?: string };
      if (!res.ok || !data.fields) {
        setDraftMessage({ ok: false, text: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      const filled = new Set<string>();
      for (const [key, value] of Object.entries(data.fields)) {
        const el = form.elements.namedItem(key);
        // Only empty fields: a guess never replaces what the user wrote.
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.value.trim()) continue;
        el.value = Array.isArray(value) ? value.join(", ") : String(value);
        filled.add(key);
      }
      setAiGenerated((prev) => new Set([...prev, ...filled]));
      refreshSnap();
      setDraftMessage(
        filled.size
          ? { ok: true, text: "Drafted by AI from the title and organization. Edit or remove anything that isn't right." }
          : { ok: false, text: "The AI couldn't suggest anything for this title." },
      );
    } catch {
      setDraftMessage({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setDrafting(false);
    }
  }

  async function fillFromFile() {
    const form = formRef.current;
    if (!original || !form) return;
    if (original.size > MAX_FILE_SIZE) {
      setFillMessage({ ok: false, text: "Files must be 10 MB or smaller." });
      return;
    }
    setFilling(true);
    setFillMessage(undefined);
    try {
      const body = new FormData();
      body.set("file", original);
      const res = await fetch("/api/ai/extract", { method: "POST", body });
      updateRemaining(res);
      const data = (await res.json().catch(() => ({}))) as { fields?: ExtractedFields; error?: string };
      if (!res.ok || !data.fields) {
        setFillMessage({ ok: false, text: data.error ?? "Something went wrong. Please try again." });
        return;
      }

      const filled = new Set<string>();
      for (const [key, value] of Object.entries(data.fields)) {
        if (key === "expires_at") {
          setStatus("has_date");
          setExpiresValue(value as string);
          setExpiresKey((k) => k + 1);
        } else {
          const input = form.elements.namedItem(key);
          if (!(input instanceof HTMLInputElement)) continue;
          input.value = Array.isArray(value) ? value.join(", ") : String(value);
        }
        filled.add(key);
      }
      setAiFields((prev) => new Set([...prev, ...filled]));
      // Values read from the file replace earlier drafts.
      setAiGenerated((prev) => new Set([...prev].filter((k) => !filled.has(k))));
      refreshSnap();
      setFillMessage(
        filled.size
          ? { ok: true, text: `Filled ${filled.size} field${filled.size === 1 ? "" : "s"}. Please check them before saving.` }
          : { ok: false, text: "No details could be found in this file." },
      );
    } catch {
      setFillMessage({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setFilling(false);
    }
  }

  // Editing an AI field makes it the user's own.
  function onFormInput(event: React.FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name;
    if (["title", "issuer_name", "description", "skills"].includes(name)) refreshSnap();
    const without = (prev: Set<string>) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    };
    setAiFields(without);
    setAiGenerated(without);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const all = new FormData(event.currentTarget);

    // Files go to /api/files; the server action only gets text fields.
    const files = new FormData();
    for (const key of ["original", "badge"] as const) {
      const file = all.get(key);
      all.delete(key);
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_FILE_SIZE) {
          setErrors({ [key]: "Files must be 10 MB or smaller." });
          return;
        }
        files.set(key, file);
      }
    }

    setErrors({});
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveCertificate(certificate?.id ?? null, all);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }

      if (files.has("original") || files.has("badge")) {
        files.set("certificate_id", result.id);
        const res = await fetch("/api/files", { method: "POST", body: files });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const message = `Your details were saved, but the upload failed: ${
            body.error ?? "please try again."
          }`;
          if (isEdit) {
            setFormError(message);
            router.refresh();
          } else {
            router.replace(`/certificates/${result.id}/edit?upload=failed`);
          }
          return;
        }
      }

      if (result.warning) {
        setFormError(result.warning);
        if (!isEdit) router.replace(`/certificates/${result.id}/edit`);
        return;
      }
      router.push("/certificates");
      router.refresh();
    });
  }

  const describedBy = (name: string) =>
    [errors[name] && `${name}-error`, aiNote(name) && `${name}-ai`].filter(Boolean).join(" ") ||
    undefined;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={onFormInput}
      className="flex flex-col gap-6"
      noValidate
    >
      <input type="hidden" name="ai_fields" value={[...aiFields].join(",")} />
      <input type="hidden" name="ai_generated_fields" value={[...aiGenerated].join(",")} />
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field name="title" label="Badge title" errors={errors} ai={aiNote("title")}>
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={certificate?.title}
              aria-invalid={!!errors.title}
              aria-describedby={describedBy("title")}
            />
          </Field>
        </div>
        <Field name="issuer_name" label="Issuing organization" errors={errors} ai={aiNote("issuer_name")}>
          <Input
            id="issuer_name"
            name="issuer_name"
            required
            maxLength={200}
            defaultValue={certificate?.issuer_name}
            aria-invalid={!!errors.issuer_name}
            aria-describedby={describedBy("issuer_name")}
          />
        </Field>
        <Field
          name="source_platform"
          label="Platform (optional)"
          hint="Where you earned it, e.g. Credly, Coursera."
          errors={errors}
        >
          <Input
            id="source_platform"
            name="source_platform"
            maxLength={200}
            defaultValue={certificate?.source_platform ?? ""}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field name="description" label="Description (optional)" errors={errors} ai={aiNote("description")}>
            <Textarea
              id="description"
              name="description"
              rows={5}
              maxLength={5000}
              defaultValue={certificate?.description ?? ""}
              aria-invalid={!!errors.description}
              aria-describedby={describedBy("description")}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            name="skills"
            label="Skills (optional)"
            hint="Separate skills with commas. Up to 30."
            errors={errors}
            ai={aiNote("skills")}
          >
            <Input
              id="skills"
              name="skills"
              defaultValue={certificate?.skills.join(", ") ?? ""}
              placeholder="e.g. Networking, Cybersecurity"
              aria-invalid={!!errors.skills}
              aria-describedby={describedBy("skills")}
            />
          </Field>
        </div>
        {(snap.descriptionEmpty || snap.skillsEmpty || draftMessage) && (
          <div className="flex flex-col items-start gap-2 rounded-lg bg-muted p-3 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                drafting ||
                pending ||
                !snap.hasTitle ||
                !snap.hasIssuer ||
                !(snap.descriptionEmpty || snap.skillsEmpty)
              }
              onClick={suggestWithAi}
            >
              <Sparkles aria-hidden /> {drafting ? "Writing…" : "Suggest with AI"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {snap.hasTitle && snap.hasIssuer
                ? "No description or skills on your certificate? AI can draft them from the title and organization. It only fills empty fields, and its text isn't from your certificate."
                : "Add a title and issuing organization to get AI suggestions for the description and skills."}
            </p>
            {remainingNote}
            {draftMessage && (
              <p
                role={draftMessage.ok ? "status" : "alert"}
                className={`text-sm ${draftMessage.ok ? "text-primary" : "text-destructive"}`}
              >
                {draftMessage.text}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field
          name="credential_id"
          label="Credential ID (optional)"
          errors={errors}
          ai={aiNote("credential_id")}
        >
          <Input
            id="credential_id"
            name="credential_id"
            maxLength={200}
            defaultValue={certificate?.credential_id ?? ""}
            aria-describedby={describedBy("credential_id")}
          />
        </Field>
        <Field
          name="credential_url"
          label="Credential URL (optional)"
          errors={errors}
          ai={aiNote("credential_url")}
        >
          <Input
            id="credential_url"
            name="credential_url"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={certificate?.credential_url ?? ""}
            aria-invalid={!!errors.credential_url}
            aria-describedby={describedBy("credential_url")}
          />
        </Field>
        <Field name="issued_at" label="Issue date (optional)" errors={errors} ai={aiNote("issued_at")}>
          <Input
            id="issued_at"
            name="issued_at"
            type="date"
            defaultValue={certificate?.issued_at ?? ""}
            aria-invalid={!!errors.issued_at}
            aria-describedby={describedBy("issued_at")}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Expiration</legend>
          {(
            [
              ["has_date", "Expires on a date"],
              ["never", "Does not expire"],
              ["unknown", "Expiration date not provided"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="expiration_status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
          {status === "has_date" && (
            <Input
              key={expiresKey}
              id="expires_at"
              name="expires_at"
              type="date"
              aria-label="Expiration date"
              defaultValue={expiresValue}
              onChange={(e) => setExpiresValue(e.currentTarget.value)}
              aria-invalid={!!errors.expires_at}
              aria-describedby={describedBy("expires_at")}
            />
          )}
          {status === "has_date" && aiFields.has("expires_at") && (
            <AiTag name="expires_at" note="suggested" />
          )}
          <FieldError errors={errors} name="expires_at" />
        </fieldset>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field
          name="original"
          label="Certificate file (optional)"
          hint="PDF, PNG, JPEG or WebP, up to 10 MB. Only you can download it. If it's an image and you don't add a badge image, a copy is used as your badge image, which can appear on your public pages."
          errors={errors}
        >
          {certificate?.original && (
            <ExistingFile file={certificate.original} onRemoved={() => router.refresh()} />
          )}
          <FilePicker
            id="original"
            label="Certificate file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onFileChange={(file) => {
              setOriginal(file);
              setFillMessage(undefined);
            }}
          />
          {original && (
            <div className="flex flex-col items-start gap-2 rounded-lg bg-muted p-3">
              <Button type="button" variant="outline" size="sm" disabled={filling || pending} onClick={fillFromFile}>
                <Sparkles aria-hidden /> {filling ? "Reading file…" : "Fill from file"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Sends this file to AI to fill in the details. Anything it finds replaces what’s in
                those fields. Always check the result.
              </p>
              {remainingNote}
              {fillMessage && (
                <p
                  role={fillMessage.ok ? "status" : "alert"}
                  className={`text-sm ${fillMessage.ok ? "text-primary" : "text-destructive"}`}
                >
                  {fillMessage.text}
                </p>
              )}
            </div>
          )}
        </Field>
        <Field
          name="badge"
          label="Badge image (optional)"
          hint="PNG, JPEG or WebP, up to 10 MB. Shown on your cards and, if you allow it, on public pages. Image metadata (like location) is removed."
          errors={errors}
        >
          {certificate?.badge && (
            <ExistingFile file={certificate.badge} onRemoved={() => router.refresh()} />
          )}
          <FilePicker id="badge" label="Badge image" accept="image/png,image/jpeg,image/webp" />
        </Field>
      </section>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="hidden_from_portfolio"
          defaultChecked={certificate?.hidden_from_portfolio ?? false}
          className="accent-primary"
        />
        Hide from my public portfolio
      </label>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add certificate"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => router.push("/certificates")}
        >
          Cancel
        </Button>
        {isEdit && (
          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="ml-auto"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        )}
      </div>

      {isEdit && (
        <DeleteCertificateDialog
          certificateId={certificate.id}
          title={certificate.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </form>
  );
}
