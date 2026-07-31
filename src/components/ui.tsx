"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ========================= Platform shortcut ======================== */

const noopSubscribe = () => () => {};
const readModifier = () =>
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘" : "Ctrl";

/**
 * "⌘" on Apple platforms, "Ctrl" everywhere else.
 *
 * Goes through useSyncExternalStore rather than an effect so the server and the
 * hydrating client agree on "Ctrl" first, then swap — no hydration mismatch and
 * no setState-in-effect.
 */
export function usePasteShortcut(): string {
  return useSyncExternalStore(noopSubscribe, readModifier, () => "Ctrl");
}

/* ============================== Button ============================== */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  className,
  type = "button",
  title,
}: ButtonProps) {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full font-semibold focus-stamp transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
  const sizes = {
    sm: "px-3.5 py-1.5 text-[13px]",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  }[size];
  const variants = {
    primary:
      "bg-stamp-600 text-white shadow-[0_6px_20px_-8px_rgba(190,30,46,0.9)] hover:bg-stamp-700 hover:shadow-[0_10px_28px_-10px_rgba(190,30,46,0.95)] hover:-translate-y-0.5",
    outline:
      "border border-hairline bg-white text-ink hover:border-stamp-300 hover:bg-stamp-50 hover:-translate-y-0.5",
    ghost: "text-ink-soft hover:bg-canvas-2 hover:text-ink",
    danger: "border border-stamp-200 bg-white text-stamp-700 hover:bg-stamp-50",
  }[variant];

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(base, sizes, variants, className)}
    >
      {loading && (
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

/* ============================== Field =============================== */

export function Field({
  label,
  hint,
  children,
  badge,
}: {
  label: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="group/field">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint transition-colors group-focus-within/field:text-stamp-600">
          {label}
        </label>
        {badge}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

/* ============================== Select ============================== */

export type SelectOption = { id: string; label: string; emoji?: string; hint?: string };

export function Select({
  value,
  onChange,
  options,
  placeholder = "Choose…",
}: {
  value: string;
  onChange: (id: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  /** Opening always starts the highlight on the current selection. */
  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  };

  const commit = (idx: number) => {
    const opt = options[idx];
    if (opt) onChange(opt.id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          "focus-stamp flex w-full items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-3 text-left text-sm font-medium transition-all duration-200",
          open
            ? "border-stamp-600 shadow-[0_0_0_3px_rgba(190,30,46,0.1)]"
            : "border-hairline hover:border-stamp-300 hover:bg-stamp-50/40",
        )}
      >
        {selected?.emoji && <span className="text-base leading-none">{selected.emoji}</span>}
        <span className={cx("flex-1 truncate", !selected && "text-ink-faint font-normal")}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 12 12"
          className={cx("h-3 w-3 shrink-0 text-ink-faint transition-transform duration-300", open && "rotate-180 text-stamp-600")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-40 mt-2 max-h-72 w-full origin-top animate-pop-in overflow-y-auto rounded-2xl border border-hairline bg-white p-1.5 shadow-[0_20px_50px_-16px_rgba(14,14,16,0.28)]"
        >
          {options.map((o, i) => {
            const isSel = o.id === value;
            return (
              <div
                key={o.id}
                data-idx={i}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                className={cx(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  i === active ? "bg-stamp-50" : "bg-transparent",
                  isSel ? "font-semibold text-stamp-700" : "text-ink",
                )}
              >
                {o.emoji && <span className="mt-px text-base leading-none">{o.emoji}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="mt-0.5 block text-xs font-normal text-ink-faint">{o.hint}</span>}
                </span>
                {isSel && (
                  <svg viewBox="0 0 12 12" className="mt-1 h-3 w-3 shrink-0 text-stamp-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6.2 4.8 9 10 3.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================ Chip toggle =========================== */

export function Chip({
  active,
  onClick,
  children,
  emoji,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  emoji?: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "focus-stamp group relative flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
        active
          ? "border-stamp-600 bg-stamp-600 text-white shadow-[0_6px_18px_-8px_rgba(190,30,46,0.85)]"
          : "border-hairline bg-white text-ink hover:-translate-y-0.5 hover:border-stamp-300 hover:bg-stamp-50/50",
      )}
    >
      {emoji && (
        <span className={cx("text-base leading-none transition-transform duration-300", active && "animate-wobble")}>
          {emoji}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate">{children}</span>
        {sub && (
          <span className={cx("block text-[11px] font-medium", active ? "text-stamp-100" : "text-ink-faint")}>
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

/* ============================== Switch ============================== */

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-stamp flex w-full items-start gap-3 rounded-2xl border border-hairline bg-white p-3.5 text-left transition-all duration-200 hover:border-stamp-300 hover:bg-stamp-50/40"
    >
      <span
        className={cx(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300",
          checked ? "bg-stamp-600" : "bg-hairline",
        )}
      >
        <span
          className={cx(
            "h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{hint}</span>}
      </span>
    </button>
  );
}

/* ============================ Number dial =========================== */

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 8,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-hairline bg-white p-1">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        className="focus-stamp flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-ink-soft transition-colors hover:bg-stamp-50 hover:text-stamp-600 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        −
      </button>
      <div className="flex-1 text-center">
        <span key={value} className="inline-block animate-pop-in text-base font-bold tabular-nums text-ink">
          {value}
        </span>
        {suffix && <span className="ml-1 text-xs font-medium text-ink-faint">{suffix}</span>}
      </div>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        className="focus-stamp flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-ink-soft transition-colors hover:bg-stamp-50 hover:text-stamp-600 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  );
}

/* ============================== Toasts ============================== */

type Toast = { id: number; message: string; tone: "info" | "error" | "success" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              "pointer-events-auto animate-pop-in rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_18px_40px_-14px_rgba(14,14,16,0.3)]",
              t.tone === "error"
                ? "border-stamp-200 bg-white text-stamp-700"
                : t.tone === "success"
                  ? "border-emerald-200 bg-white text-emerald-700"
                  : "border-hairline bg-white text-ink",
            )}
          >
            <span className="mr-1.5">{t.tone === "error" ? "⚠️" : t.tone === "success" ? "🎉" : "💡"}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ============================= Confetti ============================= */

const CONFETTI_COLORS = ["#BE1E2E", "#EF3349", "#FF9BA6", "#FFC6CC", "#0E0E10"];

/** Deterministic 0–1 noise so the burst is varied but render stays pure. */
function noise(seed: number, salt: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Bumping `fireKey` re-keys the burst. The animation ends on `forwards`, so the
 * pieces fade themselves out — no timer, no state, no effect.
 */
export function Confetti({ fireKey }: { fireKey: number }) {
  const pieces = useMemo(() => {
    if (!fireKey) return [];
    return Array.from({ length: 40 }, (_, i) => {
      const n = (salt: number) => noise(fireKey * 40 + i, salt);
      const angle = (Math.PI * 2 * i) / 40 + n(1) * 0.4;
      const dist = 120 + n(2) * 220;
      return {
        id: i,
        style: {
          "--cx": `${Math.cos(angle) * dist}px`,
          "--cy": `${Math.sin(angle) * dist - 60}px`,
          "--cr": `${n(3) * 720 - 360}deg`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: `${5 + n(4) * 6}px`,
          height: `${8 + n(5) * 10}px`,
          borderRadius: i % 3 === 0 ? "50%" : "2px",
          animationDelay: `${n(6) * 0.12}s`,
        } as React.CSSProperties,
      };
    });
  }, [fireKey]);

  if (!pieces.length) return null;
  return (
    <div
      key={fireKey}
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
      aria-hidden
    >
      {pieces.map((p) => (
        <span key={p.id} className="absolute animate-confetti" style={p.style} />
      ))}
    </div>
  );
}

/* =========================== Background ============================= */

/** Soft drifting brand blobs behind everything. Purely decorative. */
export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -left-40 -top-40 h-[38rem] w-[38rem] animate-drift rounded-full bg-[radial-gradient(circle,rgba(190,30,46,0.09),transparent_68%)]" />
      <div
        className="absolute -right-52 top-1/4 h-[34rem] w-[34rem] animate-drift rounded-full bg-[radial-gradient(circle,rgba(239,51,73,0.07),transparent_68%)]"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="absolute bottom-[-16rem] left-1/3 h-[30rem] w-[30rem] animate-drift rounded-full bg-[radial-gradient(circle,rgba(255,155,166,0.11),transparent_68%)]"
        style={{ animationDelay: "-15s" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,14,16,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(14,14,16,0.022)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
    </div>
  );
}

/* ============================== Logo ================================ */

export function StampMark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.7rem] bg-stamp-600 text-white transition-transform duration-500 hover:rotate-6 hover:scale-110",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M12 20.5s-7.4-4.6-7.4-9.6A4.3 4.3 0 0 1 12 8.3a4.3 4.3 0 0 1 7.4 2.6c0 5-7.4 9.6-7.4 9.6Z" />
      </svg>
      <span className="absolute inset-0 rounded-[0.7rem] ring-1 ring-inset ring-white/25" />
    </span>
  );
}
