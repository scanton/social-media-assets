"use client";

import { useMemo, useState } from "react";
import { cx } from "../ui";
import { HelpTip } from "../HelpTip";

export interface CatalogueOption {
  id: string;
  label: string;
  /** Inline SVG markup, or a data URI for an <img>. */
  thumb?: string;
  thumbIsUri?: boolean;
  /** What this option is for. Shown on hover, alongside the catalogue ID. */
  hint?: string;
}

/**
 * A grid of catalogue options with real thumbnails.
 *
 * Every thumbnail is drawn by the kit itself rather than shipped as a picture,
 * so a picker can never show art the renderer will not produce. `catalog-ids.md`
 * asks that assets be referred to by ID, so the ID is shown alongside the label
 * rather than hidden behind it.
 */
export function CataloguePicker({
  label,
  help,
  hint,
  options,
  value,
  onChange,
  allowNone = false,
  columns = 6,
  searchable = false,
}: {
  label: string;
  /** Key into the help registry. Draws a "?" beside the label. */
  help?: string;
  hint?: string;
  options: CatalogueOption[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  allowNone?: boolean;
  columns?: number;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <div>
      {/* Skipped when the picker sits inside a Disclosure, which already
          carries the name and the count in its own header. */}
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <label className="truncate text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
              {label}
            </label>
            {help && <HelpTip id={help} className="self-center" />}
          </span>
          <span className="text-[10px] tabular-nums text-ink-faint">{options.length}</span>
        </div>
      )}

      {searchable && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          className="focus-stamp mb-2 w-full rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs transition-colors focus:border-stamp-600"
        />
      )}

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="None"
            className={cx(
              "focus-stamp grid aspect-square place-items-center rounded-lg border text-[10px] font-bold transition-colors",
              value === undefined
                ? "border-stamp-600 bg-stamp-50 text-stamp-700"
                : "border-hairline bg-white text-ink-faint hover:border-stamp-300",
            )}
          >
            none
          </button>
        )}

        {shown.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.hint ? `${o.label} · ${o.id}\n${o.hint}` : `${o.label} · ${o.id}`}
            className={cx(
              "focus-stamp grid aspect-square place-items-center overflow-hidden rounded-lg border p-1 transition-colors",
              value === o.id
                ? "border-stamp-600 bg-stamp-50 ring-1 ring-stamp-200"
                : "border-hairline bg-white hover:border-stamp-300",
            )}
          >
            {o.thumb ? (
              o.thumbIsUri ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={o.thumb} alt="" className="h-full w-full object-contain" />
              ) : (
                <span
                  className="grid h-full w-full place-items-center [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: o.thumb }}
                />
              )
            ) : (
              <span className="px-0.5 text-center text-[9px] font-semibold leading-tight text-ink-soft">
                {o.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}
