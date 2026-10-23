"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Plain-text paragraph clamped to 4 lines with a "See more" toggle that only
// appears when the text actually overflows.
export function ExpandableText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="flex flex-col items-start gap-1">
      <p ref={ref} className={`leading-7 whitespace-pre-line ${expanded ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
