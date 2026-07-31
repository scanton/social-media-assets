"use client";

import { useCallback, useRef, useState } from "react";
import { awaitJob, NoKeyError, submitJob } from "@/lib/client-api";
import type { Asset, AssetKind, Job } from "@/lib/studio-types";

export type JobSpec = {
  label: string;
  kind: AssetKind;
  model: string;
  input: Record<string, unknown>;
  /**
   * Turns a fal payload into studio assets. May be async — the scene step awaits
   * a canvas watermark pass here, and the job stays "running" until it lands.
   */
  toAssets: (data: unknown, jobId: string) => Asset[] | Promise<Asset[]>;
};

const MAX_CONCURRENT = 3;

export function useJobRunner(opts: {
  onAssets: (assets: Asset[]) => void;
  onNeedKey: () => void;
  onBatchDone: (result: { produced: number; failed: number; firstError?: string }) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // Keep the latest callbacks without re-creating `run` on every render.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const patch = useCallback((id: string, next: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...next } : j)));
  }, []);

  const run = useCallback(
    async (specs: JobSpec[]) => {
      if (!specs.length) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const seeded: Job[] = specs.map((s, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        label: s.label,
        kind: s.kind,
        model: s.model,
        state: "queued",
        startedAt: Date.now(),
      }));
      setJobs(seeded);

      let produced = 0;
      let failed = 0;
      let firstError: string | undefined;
      let cursor = 0;
      let sawKeyError = false;

      const worker = async () => {
        for (;;) {
          const index = cursor++;
          if (index >= specs.length) return;
          if (controller.signal.aborted) {
            patch(seeded[index].id, { state: "cancelled" });
            continue;
          }

          const spec = specs[index];
          const job = seeded[index];
          patch(job.id, { state: "running" });

          try {
            const requestId = await submitJob(spec.model, spec.input);
            const data = await awaitJob<unknown>(spec.model, requestId, {
              signal: controller.signal,
              onUpdate: (u) => patch(job.id, { queuePosition: u.queuePosition }),
            });
            const assets = await spec.toAssets(data, job.id);
            produced += assets.length;
            optsRef.current.onAssets(assets);
            patch(job.id, { state: "done", finishedAt: Date.now() });
          } catch (err) {
            if ((err as Error).name === "AbortError") {
              patch(job.id, { state: "cancelled" });
              continue;
            }
            if (err instanceof NoKeyError) {
              sawKeyError = true;
              controller.abort();
              patch(job.id, { state: "error", error: err.message });
              continue;
            }
            failed += 1;
            firstError ??= (err as Error).message;
            patch(job.id, { state: "error", error: (err as Error).message });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENT, specs.length) }, () => worker()),
      );

      abortRef.current = null;

      if (sawKeyError) {
        optsRef.current.onNeedKey();
        return;
      }

      optsRef.current.onBatchDone({ produced, failed, firstError });
    },
    [patch],
  );

  const cancelAll = useCallback(() => abortRef.current?.abort(), []);
  const clearJobs = useCallback(() => setJobs([]), []);

  const busy = jobs.some((j) => j.state === "queued" || j.state === "running");

  return { jobs, run, busy, cancelAll, clearJobs };
}
