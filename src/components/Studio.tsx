"use client";

import { useEffect, useState } from "react";
import { getKeyState } from "@/lib/client-api";
import { signOutAction } from "@/app/actions";
import type { StudioUser } from "@/auth";
import { BRAND } from "@/lib/brand";
import { SURFACES, type SurfaceKind } from "@/lib/options";
import { StudioProvider, useStudio } from "./studio-store";
import { KeyDialog } from "./KeyDialog";
import { AssetTile } from "./AssetTile";
import { Step1Card } from "./steps/Step1Card";
import { OneShot } from "./OneShot";
import { Backdrop, Button, Confetti, StampMark, ToastProvider, cx } from "./ui";

type Step = { n: number; label: string; emoji: string };

/* What you're selling decides the pipeline, so it also decides the steps. */
const STEPS: Record<SurfaceKind, Step[]> = {
  print: [
    { n: 1, label: "Artwork", emoji: "🎨" },
    { n: 2, label: "Video", emoji: "🎬" },
  ],
  screen: [
    { n: 1, label: "Clip", emoji: "🎞️" },
    { n: 2, label: "Video", emoji: "🎬" },
  ],
};

export function Studio({
  user,
  authEnabled,
  devMode,
}: {
  user: StudioUser;
  authEnabled: boolean;
  devMode: boolean;
}) {
  return (
    <ToastProvider>
      <StudioProvider>
        <StudioShell user={user} authEnabled={authEnabled} devMode={devMode} />
      </StudioProvider>
    </ToastProvider>
  );
}

function StudioShell({
  user,
  authEnabled,
  devMode,
}: {
  user: StudioUser;
  authEnabled: boolean;
  devMode: boolean;
}) {
  const s = useStudio();
  const [rollOpen, setRollOpen] = useState(false);

  useEffect(() => {
    void getKeyState().then((state) => {
      s.setKeyConnected(state.connected);
      s.setKeyHint(state.hint);
      if (!state.connected) s.setKeyDialogOpen(true);
    });
    // Runs once on mount; setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = STEPS[s.surface];
  const done: Record<number, boolean> = {
    1: s.assets.some((a) => (s.surface === "screen" ? a.kind === "card-video" : a.kind === "card-art")),
    2: s.assets.some((a) => a.kind === "video"),
  };

  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <Confetti fireKey={s.confettiKey} />

      {/* ------------------------------ header ------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-hairline/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[110rem] items-center gap-3 px-4 py-3 sm:px-6">
          <StampMark />
          {/* Below sm the header row is too tight for the wordmark — the mark carries it. */}
          <div className="hidden min-w-0 leading-tight sm:block">
            <p className="truncate font-display text-sm font-extrabold tracking-tight text-ink">
              {BRAND.name} <span className="text-stamp-600">{BRAND.product}</span>
            </p>
            <p className="hidden text-[11px] font-medium text-ink-faint md:block">
              Card → lifestyle scene → social video
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {s.busy && (
              <span className="hidden items-center gap-2 rounded-full border border-stamp-200 bg-stamp-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stamp-700 sm:flex">
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-stamp-600" />
                Rendering
              </span>
            )}

            <button
              type="button"
              onClick={() => setRollOpen((v) => !v)}
              className={cx(
                "focus-stamp relative rounded-full border px-3.5 py-2 text-xs font-bold transition-all hover:-translate-y-0.5",
                rollOpen
                  ? "border-stamp-600 bg-stamp-600 text-white"
                  : "border-hairline bg-white text-ink hover:border-stamp-300",
              )}
            >
              Roll
              {s.assets.length > 0 && (
                <span
                  className={cx(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    rollOpen ? "bg-white/20" : "bg-stamp-50 text-stamp-700",
                  )}
                >
                  {s.assets.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={s.openKeyDialog}
              title={s.keyConnected ? `fal key ${s.keyHint ?? "connected"}` : "Add your fal.ai key"}
              className={cx(
                "focus-stamp flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all hover:-translate-y-0.5",
                s.keyConnected
                  ? "border-hairline bg-white text-ink hover:border-stamp-300"
                  : "animate-pulse-ring border-stamp-600 bg-stamp-600 text-white",
              )}
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  s.keyConnected ? "bg-emerald-500" : "bg-white",
                )}
              />
              <span className="hidden sm:inline">{s.keyConnected ? "fal connected" : "Add fal key"}</span>
              <span className="sm:hidden">fal</span>
            </button>

{/* No account UI while AUTH_ENABLED is false — see src/auth.ts */}
            {authEnabled && (
              <div className="flex items-center gap-2 border-l border-hairline pl-2">
                {user.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-canvas-2 text-xs font-bold text-ink-soft">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {!devMode && (
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="focus-stamp hidden rounded-full px-2 py-1 text-[11px] font-bold text-ink-faint transition-colors hover:text-stamp-600 sm:block"
                    >
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --------------------------- what we sell --------------------------- */}
        {/* This is the pipeline choice, not a view toggle, so it gets the weight
            of a real decision rather than a pill. */}
        <div className="mx-auto max-w-[110rem] px-4 pb-3 sm:px-6">
          <div role="tablist" aria-label="What are we selling?" className="flex flex-wrap gap-2">
            {SURFACES.map((opt) => {
              const active = s.surface === opt.kind;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => s.setSurface(opt.kind)}
                  className={cx(
                    "focus-stamp group flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left transition-all duration-200 active:scale-[0.98]",
                    active
                      ? "border-stamp-600 bg-stamp-600 text-white shadow-[0_6px_18px_-8px_rgba(190,30,46,0.85)]"
                      : "border-hairline bg-white text-ink hover:-translate-y-0.5 hover:border-stamp-300 hover:bg-stamp-50/50",
                  )}
                >
                  <span
                    className={cx(
                      "text-lg leading-none transition-transform duration-300",
                      active && "animate-wobble",
                    )}
                  >
                    {opt.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">{opt.label}</span>
                    <span
                      className={cx(
                        "mt-0.5 hidden text-[11px] font-medium leading-tight sm:block",
                        active ? "text-stamp-100" : "text-ink-faint",
                      )}
                    >
                      {opt.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ----------------------------- step rail ---------------------------- */}
        <nav className="mx-auto max-w-[110rem] px-4 pb-3 sm:px-6" aria-label="Workflow steps">
          <ol className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {steps.map((st, i) => {
              const active = s.step === st.n;
              return (
                <li key={st.n} className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => s.setStep(st.n)}
                    aria-current={active ? "step" : undefined}
                    className={cx(
                      "focus-stamp group flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition-all duration-300",
                      active
                        ? "border-stamp-600 bg-stamp-600 text-white shadow-[0_6px_18px_-8px_rgba(190,30,46,0.85)]"
                        : "border-hairline bg-white text-ink-soft hover:-translate-y-0.5 hover:border-stamp-300 hover:text-ink",
                    )}
                  >
                    <span
                      className={cx(
                        "grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold transition-colors",
                        active
                          ? "bg-white/25 text-white"
                          : done[st.n]
                            ? "bg-stamp-600 text-white"
                            : "bg-canvas-2 text-ink-faint",
                      )}
                    >
                      {done[st.n] && !active ? "✓" : st.n}
                    </span>
                    <span className={cx("transition-transform duration-300", active && "animate-wobble")}>
                      {st.emoji}
                    </span>
                    {st.label}
                  </button>
                  {i < steps.length - 1 && (
                    <span
                      className={cx(
                        "h-px w-4 transition-colors duration-500 sm:w-6",
                        done[st.n] ? "bg-stamp-400" : "bg-hairline",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {devMode && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
          ⚠️ Running without Google sign-in (local development only). Set{" "}
          <code className="rounded bg-white/70 px-1">AUTH_GOOGLE_ID</code> /{" "}
          <code className="rounded bg-white/70 px-1">AUTH_GOOGLE_SECRET</code> to enable the{" "}
          @{BRAND.allowedDomain} gate.
        </div>
      )}

      {/* ------------------------------- main ------------------------------- */}
      <main className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6 sm:py-10">
        <div key={`${s.surface}-${s.step}`} className="animate-rise">
          {s.step === 1 ? <Step1Card /> : <OneShot />}
        </div>
      </main>

      <footer className="border-t border-hairline px-4 py-8 text-center sm:px-6">
        <p className="text-xs leading-relaxed text-ink-faint">
          Assets are generated on your own fal.ai account and served from fal&apos;s CDN.{" "}
          {BRAND.name} {BRAND.product}{" "}
          doesn&apos;t store your key or keep your assets — download what you want to keep.
        </p>
      </footer>

      {/* ------------------------------- roll ------------------------------- */}
      <AssetRoll open={rollOpen} onClose={() => setRollOpen(false)} />

      <KeyDialog
        open={s.keyDialogOpen}
        onClose={() => s.setKeyDialogOpen(false)}
        connected={s.keyConnected}
        hint={s.keyHint}
        onSaved={(hint) => {
          s.setKeyConnected(Boolean(hint));
          s.setKeyHint(hint);
        }}
      />
    </div>
  );
}

const ROLL_FILTERS = [
  { id: "all", label: "Everything" },
  { id: "base", label: "Scenes" },
  { id: "video", label: "Video" },
  { id: "card-art", label: "Uploads" },
] as const;

function AssetRoll({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStudio();
  const [filter, setFilter] = useState<(typeof ROLL_FILTERS)[number]["id"]>("all");

  const shown = s.assets.filter((a) => {
    if (filter === "all") return true;
    if (filter === "card-art") return a.kind === "card-art" || a.kind === "card-video";
    return a.kind === filter;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-hairline bg-white shadow-2xl"
        style={{ animation: "rise 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Asset roll"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Studio roll</h2>
            <p className="text-xs text-ink-faint">
              {s.assets.length} asset{s.assets.length === 1 ? "" : "s"} this session
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-stamp rounded-full p-2 text-ink-faint transition-colors hover:bg-canvas-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto border-b border-hairline px-5 py-3">
          {ROLL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cx(
                "focus-stamp shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors",
                filter === f.id ? "bg-stamp-600 text-white" : "bg-canvas-2 text-ink-soft hover:bg-stamp-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {shown.length ? (
            <div className="grid grid-cols-2 gap-3">
              {shown.map((a) => (
                <AssetTile key={a.id} asset={a} onRemove={() => s.removeAsset(a.id)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="animate-float text-3xl">🪺</span>
              <p className="mt-3 text-sm text-ink-faint">Nothing here yet.</p>
            </div>
          )}
        </div>

        {s.assets.length > 0 && (
          <div className="border-t border-hairline p-4">
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                if (confirm("Clear every asset from this session? Downloads you've already saved are safe.")) {
                  s.clearAssets();
                }
              }}
            >
              Clear the roll
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
