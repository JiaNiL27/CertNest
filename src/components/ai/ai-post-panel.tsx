"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Save, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/certnest/copy-button";
import { PanelSkeleton } from "@/components/certnest/skeletons";
import {
  getAiPanelState,
  saveLinkedInPost,
  type AiPanelState,
} from "@/app/(app)/certificates/ai-actions";
import { LANGUAGES, TONES, type LanguageCode, type Tone } from "@/lib/ai/prompt";

const LINKEDIN_LIMIT = 3000;
const selectClass =
  "h-9 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// Draft a LinkedIn post with AI, then edit, regenerate, copy or save it.
export function AiPostPanel({
  certificateId,
  initial,
}: {
  certificateId: string;
  /** Server-loaded state; when given, the panel doesn't fetch on mount. */
  initial?: AiPanelState;
}) {
  const savedEn = initial?.saved.en;
  const [state, setState] = useState<AiPanelState | null>(initial ?? null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [tone, setTone] = useState<Tone>(
    TONES.some((t) => t.value === savedEn?.tone) ? (savedEn!.tone as Tone) : "professional",
  );
  const [text, setText] = useState(savedEn?.content ?? "");
  const [savedText, setSavedText] = useState(savedEn?.content ?? "");
  const [status, setStatus] = useState<"idle" | "writing" | "saving">("idle");
  const [error, setError] = useState<string>();
  const [notFound, setNotFound] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initial) return () => abortRef.current?.abort();
    let active = true;
    getAiPanelState(certificateId).then((s) => {
      if (!active) return;
      if (!s) return setNotFound(true);
      setState(s);
      const saved = s.saved.en;
      if (saved) {
        setText(saved.content);
        setSavedText(saved.content);
        if (TONES.some((t) => t.value === saved.tone)) setTone(saved.tone as Tone);
      }
    });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
    // `initial` is only read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificateId]);

  if (notFound) return <p className="text-sm text-muted-foreground">This certificate could not be found.</p>;
  if (!state) return <PanelSkeleton label="Loading the AI post writer" />;

  const dirty = text !== savedText;
  const writing = status === "writing";

  function switchLanguage(next: LanguageCode) {
    if (dirty && text.trim() && !window.confirm("Discard your unsaved changes?")) return;
    const saved = state!.saved[next];
    setLanguage(next);
    setText(saved?.content ?? "");
    setSavedText(saved?.content ?? "");
    setError(undefined);
  }

  async function generate() {
    if (dirty && text.trim() && !window.confirm("Replace the current text with a new draft?")) return;
    setError(undefined);
    setStatus("writing");
    setText("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId, language, tone }),
        signal: controller.signal,
      });
      const remaining = Number(res.headers.get("X-AI-Remaining"));
      if (res.headers.has("X-AI-Remaining") && !Number.isNaN(remaining)) {
        setState((s) => s && { ...s, remaining });
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Something went wrong while writing. Please try again.");
        setText(savedText);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setText(result);
      }
      setText(result.trim());
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("The draft stopped before it finished. You can edit what's there or try again.");
      }
    } finally {
      setStatus("idle");
      abortRef.current = null;
    }
  }

  async function save() {
    setError(undefined);
    setStatus("saving");
    const result = await saveLinkedInPost({ certificateId, language, tone, content: text });
    setStatus("idle");
    if ("error" in result && result.error) return setError(result.error);
    setSavedText(text.trim());
    setText(text.trim());
    setState((s) =>
      s && {
        ...s,
        saved: { ...s.saved, [language]: { content: text.trim(), tone, updated_at: result.updated_at! } },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!state.enoughDetail && (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Add a description or skills for a better post.{" "}
          <Link href={`/certificates/${certificateId}/edit`} className="font-medium text-primary underline">
            Edit certificate
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Language
          <select
            className={selectClass}
            value={language}
            disabled={writing}
            onChange={(e) => switchLanguage(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Tone
          <select
            className={selectClass}
            value={tone}
            disabled={writing}
            onChange={(e) => setTone(e.target.value as Tone)}
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {writing ? (
          <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>
            <Square aria-hidden /> Stop
          </Button>
        ) : (
          <Button type="button" onClick={generate} disabled={state.remaining <= 0 || status !== "idle"}>
            <Sparkles aria-hidden /> {text.trim() ? "Regenerate" : "Write with AI"}
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {state.remaining} of 10 AI drafts left this hour
        </span>
      </div>

      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={writing}
          rows={9}
          maxLength={10000}
          aria-label="LinkedIn post"
          placeholder="Your post will appear here. You can also write it yourself."
          className="min-h-48 resize-y leading-relaxed"
        />
        {writing && (
          <Loader2 className="absolute top-3 right-3 size-4 animate-spin text-muted-foreground" aria-label="Writing" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={save} disabled={!text.trim() || !dirty || status !== "idle"}>
          {dirty || !text.trim() ? <Save aria-hidden /> : <Check aria-hidden />}
          {status === "saving" ? "Saving…" : dirty || !text.trim() ? "Save" : "Saved"}
        </Button>
        {text.trim() && <CopyButton value={text} label="Copy post" />}
        <span className={`ml-auto text-xs ${text.length > LINKEDIN_LIMIT ? "text-destructive" : "text-muted-foreground"}`}>
          {text.length} / {LINKEDIN_LIMIT}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        AI can make mistakes. Check the post before you share it. Drafts are private to you.
      </p>
    </div>
  );
}
