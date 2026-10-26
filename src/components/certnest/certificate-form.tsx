"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCertificate, deleteFileAction } from "@/app/(app)/certificates/actions";
import type { CertificateDetail, CertificateFile } from "@/lib/certificates/queries";
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

function Field({
  name,
  label,
  hint,
  errors,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  errors: Errors;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
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
function FilePicker({ id, accept, label }: { id: string; accept: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);

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

  const isEdit = !!certificate;

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

  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field name="title" label="Badge title" errors={errors}>
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
        <Field name="issuer_name" label="Issuing organization" errors={errors}>
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
          <Field name="description" label="Description (optional)" errors={errors}>
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
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field name="credential_id" label="Credential ID (optional)" errors={errors}>
          <Input
            id="credential_id"
            name="credential_id"
            maxLength={200}
            defaultValue={certificate?.credential_id ?? ""}
          />
        </Field>
        <Field name="credential_url" label="Credential URL (optional)" errors={errors}>
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
        <Field name="issued_at" label="Issue date (optional)" errors={errors}>
          <Input
            id="issued_at"
            name="issued_at"
            type="date"
            defaultValue={certificate?.issued_at ?? ""}
            aria-invalid={!!errors.issued_at}
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
              id="expires_at"
              name="expires_at"
              type="date"
              aria-label="Expiration date"
              defaultValue={certificate?.expires_at ?? ""}
              aria-invalid={!!errors.expires_at}
              aria-describedby={describedBy("expires_at")}
            />
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
          />
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
