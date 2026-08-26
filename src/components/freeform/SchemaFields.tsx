"use client";

import { Field, Select, Switch, cx } from "../ui";
import type { InputSchema, JsonSchemaProp } from "@/lib/model-catalog";

/**
 * Controls built from a model's own input schema.
 *
 * Every model on fal declares different knobs. Hardcoding a fixed set would
 * mean either hiding things a model can do or offering things it cannot, and
 * both are worse than reading what it says about itself. So: an enum becomes a
 * dropdown, a bounded number becomes a slider, a boolean becomes a switch, and
 * anything unrecognised is left alone rather than guessed at.
 *
 * What is deliberately NOT drawn here: the prompt, and any image or video
 * input. Those have their own places in the page, and rendering them twice
 * would be confusing.
 */

const SKIP = new Set([
  "prompt", "negative_prompt",
  "image_url", "image_urls", "video_url", "video_urls",
  "reference_image_urls", "reference_video_urls", "audio_urls",
  "end_image_url", "poster",
  // Housekeeping fields nobody wants to see.
  "seed", "enable_safety_checker", "safety_tolerance", "sync_mode",
  "end_user_id", "output_format",
]);

/** Reads a property through an `anyOf`, which is how fal declares unions. */
function branches(prop: JsonSchemaProp): JsonSchemaProp[] {
  return prop.anyOf?.length ? [prop, ...prop.anyOf] : [prop];
}

function enumOf(prop: JsonSchemaProp): unknown[] | null {
  for (const b of branches(prop)) {
    if (Array.isArray(b.enum) && b.enum.length) return b.enum;
  }
  return null;
}

function typeOf(prop: JsonSchemaProp): string | undefined {
  for (const b of branches(prop)) if (b.type) return b.type;
  return undefined;
}

/** `guidance_scale` reads better as "Guidance scale". */
const humanise = (key: string) =>
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function SchemaFields({
  schema,
  values,
  onChange,
}: {
  schema: InputSchema | null;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (!schema) return null;

  const entries = Object.entries(schema.properties).filter(([key]) => !SKIP.has(key));
  if (!entries.length) {
    return (
      <p className="text-xs text-ink-faint">
        This model takes a prompt and nothing else to tune.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {entries.map(([key, prop]) => {
        const options = enumOf(prop);
        const type = typeOf(prop);
        const required = schema.required.includes(key);
        const hint = [prop.description, required ? "Required" : null].filter(Boolean).join(" · ") || undefined;
        const current = values[key];

        if (options) {
          return (
            <Field key={key} label={humanise(key)} hint={hint}>
              <Select
                value={String(current ?? prop.default ?? options[0])}
                onChange={(v) => onChange(key, v)}
                options={options.map((o) => ({ id: String(o), label: String(o) }))}
              />
            </Field>
          );
        }

        if (type === "boolean") {
          return (
            <Field key={key} label={humanise(key)} hint={hint}>
              <Switch
                checked={Boolean(current ?? prop.default ?? false)}
                onChange={(v) => onChange(key, v)}
                label={humanise(key)}
              />
            </Field>
          );
        }

        if (type === "integer" || type === "number") {
          // A slider only when the schema says where the ends are. Without a
          // range, a number box is honest and a slider is a guess.
          const min = typeof prop.minimum === "number" ? prop.minimum : undefined;
          const max = typeof prop.maximum === "number" ? prop.maximum : undefined;
          const step = type === "integer" ? 1 : 0.1;
          const value = Number(current ?? prop.default ?? min ?? 0);
          return (
            <Field key={key} label={humanise(key)} hint={hint ? `${hint} · ${value}` : String(value)}>
              {min !== undefined && max !== undefined ? (
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => onChange(key, Number(e.target.value))}
                  className="focus-stamp w-full accent-stamp-600"
                />
              ) : (
                <input
                  type="number"
                  step={step}
                  value={value}
                  onChange={(e) => onChange(key, Number(e.target.value))}
                  className="focus-stamp w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                />
              )}
            </Field>
          );
        }

        if (type === "string") {
          return (
            <Field key={key} label={humanise(key)} hint={hint}>
              <input
                value={String(current ?? prop.default ?? "")}
                onChange={(e) => onChange(key, e.target.value)}
                className="focus-stamp w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
              />
            </Field>
          );
        }

        // An object or an array we have no sensible control for. Saying so beats
        // rendering a text box that will fail validation at submit time.
        return (
          <Field key={key} label={humanise(key)} hint={hint}>
            <p className={cx("rounded-xl border border-hairline bg-paper px-3 py-2 text-xs text-ink-faint")}>
              This model&rsquo;s own default is used.
            </p>
          </Field>
        );
      })}
    </div>
  );
}
