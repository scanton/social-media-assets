import "server-only";
import { falForRequest } from "@/lib/fal-server";
import { replicateFetch, requireReplicateKey } from "@/lib/replicate-server";
import { replicateModel } from "@/lib/replicate-catalog";
import type { ProviderId } from "@/lib/providers";
import { inputInDialect } from "@/lib/prompt-dialect";
import { normaliseOutput } from "@/lib/provider-output";
import { renderWithOpenAI, requireOpenAIKey } from "@/lib/openai-server";

/**
 * Submitting and polling, for either provider.
 *
 * The two APIs are shaped alike — post a job, get an id, poll until it settles
 * — so this is mostly renaming. The parts that are not renaming are worth
 * naming out loud, because each one is a way a render can go wrong silently.
 */

/* ----------------------------- submitting ---------------------------- */

/**
 * A queued job, or a finished one.
 *
 * fal and Replicate hand back an id to poll. OpenAI hands back the picture, so
 * there is nothing to poll and `data` is set instead — the client skips the
 * wait rather than asking a stateless function to remember a result it was
 * never given anywhere to put.
 */
export type Submitted = { requestId: string; data?: unknown };

export async function submitToProvider(
  provider: ProviderId,
  model: string,
  input: Record<string, unknown>,
): Promise<Submitted> {
  if (provider === "openai") {
    const key = await requireOpenAIKey();
    const data = await renderWithOpenAI(key, model, input);
    // The id is for the log line and the job tile, not for a lookup.
    return { requestId: `openai-${Date.now().toString(36)}`, data };
  }

  if (provider === "fal") {
    const fal = await falForRequest();
    const queued = await fal.queue.submit(model, { input });
    return { requestId: queued.request_id };
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
  return { requestId: body.id };
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

  if (provider === "openai") {
    // Unreachable in practice: the submit route answers inline, so the client
    // never polls. Explicit rather than silently falling into Replicate's
    // branch with an id Replicate has never heard of.
    throw new Error("OpenAI renders return immediately and are not polled.");
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
