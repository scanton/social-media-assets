import "server-only";
import { falForRequest } from "@/lib/fal-server";
import { replicateFetch, requireReplicateKey } from "@/lib/replicate-server";
import { replicateModel } from "@/lib/replicate-catalog";
import type { ProviderId } from "@/lib/providers";
import { inputInDialect } from "@/lib/prompt-dialect";
import { normaliseOutput } from "@/lib/provider-output";

/**
 * Submitting and polling, for either provider.
 *
 * The two APIs are shaped alike — post a job, get an id, poll until it settles
 * — so this is mostly renaming. The parts that are not renaming are worth
 * naming out loud, because each one is a way a render can go wrong silently.
 */

/* ----------------------------- submitting ---------------------------- */

export async function submitToProvider(
  provider: ProviderId,
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (provider === "fal") {
    const fal = await falForRequest();
    const queued = await fal.queue.submit(model, { input });
    return queued.request_id;
  }

  // `@Video1` is fal's spelling; Replicate reads `[Video1]`. See prompt-dialect.
  input = inputInDialect(input, provider);

  const key = await requireReplicateKey();
  const target = await replicateModel(model, key);

  /*
   * Two endpoints, and picking the wrong one is a 404 rather than anything
   * legible. Official models are always on and are addressed by name with no
   * version; community models are addressed by the version id, because a
   * community model's inputs can change under you and Replicate makes you say
   * which build you meant.
   */
  const [owner, name] = model.split("/");
  const body = (await (target?.isOfficial
    ? replicateFetch(key, `/models/${owner}/${name}/predictions`, {
        method: "POST",
        json: { input },
      })
    : replicateFetch(key, "/predictions", {
        method: "POST",
        json: { version: target?.versionId, input },
      }))) as { id?: unknown };

  if (typeof body?.id !== "string") throw new Error("Replicate did not return a prediction id.");
  return body.id;
}

/* ------------------------------ polling ------------------------------ */

export type JobStatus =
  | { status: "COMPLETED"; data: unknown }
  | { status: string; queuePosition?: number };

/**
 * Replicate's terminal failures have no equivalent in fal's client types, and
 * the client polls in an unbounded loop that only stops on COMPLETED — so a
 * failed prediction reported as just another status would spin forever, with a
 * progress bar, until the tab closed. They are turned into thrown errors here,
 * which the poll loop already knows how to surface.
 */
const REPLICATE_DEAD = new Set(["failed", "canceled", "aborted"]);

export async function statusFromProvider(
  provider: ProviderId,
  model: string,
  requestId: string,
): Promise<JobStatus> {
  if (provider === "fal") {
    const fal = await falForRequest();
    const status = await fal.queue.status(model, { requestId, logs: true });
    if (status.status !== "COMPLETED") {
      return {
        status: status.status,
        queuePosition: "queue_position" in status ? status.queue_position : undefined,
      };
    }
    const result = await fal.queue.result(model, { requestId });
    return { status: "COMPLETED", data: result.data };
  }

  const key = await requireReplicateKey();
  const p = (await replicateFetch(key, `/predictions/${requestId}`)) as {
    status?: string;
    output?: unknown;
    error?: unknown;
  };

  const s = String(p.status ?? "");
  if (REPLICATE_DEAD.has(s)) {
    const detail = typeof p.error === "string" && p.error ? p.error : `The prediction ${s}.`;
    throw new Error(detail);
  }
  if (s === "succeeded") return { status: "COMPLETED", data: normaliseOutput(p.output) };
  // starting | processing — Replicate publishes no queue position.
  return { status: s || "IN_PROGRESS" };
}
