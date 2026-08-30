"use client";

import { useEffect, useState } from "react";
import { clearKey, saveKey } from "@/lib/client-api";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { Button, cx } from "./ui";

type DialogProps = {
  onClose: () => void;
  onSaved: (hint: string | null) => void;
  connected: boolean;
  hint: string | null;
  /** Whose key is being set. The dialog is otherwise identical for both. */
  provider: ProviderId;
};

/**
 * Unmounted while closed, so every open starts with an empty field and no stale
 * error — no reset effect needed.
 */
export function KeyDialog({ open, ...props }: DialogProps & { open: boolean }) {
  if (!open) return null;
  return <KeyDialogBody {...props} />;
}

function KeyDialogBody({ onClose, onSaved, connected, hint, provider }: DialogProps) {
  const spec = PROVIDERS[provider];
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await saveKey(value, provider);
      onSaved(res.hint);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await clearKey(provider);
    onSaved(null);
    setBusy(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${spec.label} API key`}
    >
      <div
        className="card-surface w-full max-w-lg animate-pop-in p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              Your {spec.label} key 🔑
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Generations run on your own {spec.label} account. The key is stored in a secure,
              http-only cookie on this browser — it never touches our database.
            </p>
          </div>
          <button
            onClick={onClose}
            className="focus-stamp -mr-1 -mt-1 shrink-0 rounded-full p-2 text-ink-faint transition-colors hover:bg-canvas-2 hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {connected && (
          <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Connected{hint ? ` — ${hint}` : ""}
          </div>
        )}

        <div className="mt-5">
          <label htmlFor="falkey" className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
            {connected ? "Replace key" : "Paste key"}
          </label>
          <input
            id="falkey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && submit()}
            placeholder={spec.keyExample}
            className={cx(
              "focus-stamp mt-1.5 w-full rounded-2xl border bg-white px-4 py-3 font-mono text-sm transition-all",
              error ? "border-stamp-400" : "border-hairline focus:border-stamp-600",
            )}
          />
          {error && <p className="mt-2 text-sm font-medium text-stamp-700">{error}</p>}
          <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
            Grab one at{" "}
            <a
              href={spec.keysUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-stamp-600 underline decoration-stamp-200 underline-offset-2 hover:decoration-stamp-600"
            >
              {spec.keysUrl.replace("https://", "")}
            </a>
            .
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={!value.trim()} loading={busy}>
            {connected ? "Update key" : "Connect"}
          </Button>
          {connected && (
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
