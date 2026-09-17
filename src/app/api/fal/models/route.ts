import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { categoryModels, compatibleModels, isOpenCategory } from "@/lib/model-catalog";
import { activeProvider } from "@/lib/active-provider";
import { slotFallback, slotCapability } from "@/lib/models";
import { MODEL_SLOTS, isModelSlotId } from "@/lib/models";

/**
 * The models a given step can run on.
 *
 * One slot per request so a slow category can't hold up the others, and so the
 * picker can load lazily when it's opened rather than on every page view.
 *
 * A catalogue failure returns the shipped default with `partial: true` instead
 * of an error — the studio stays usable, the picker just has nothing new to
 * offer.
 */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;

  /*
   * Two ways to ask. A slot wants the models that can take a specific payload,
   * which is what the guided pipelines need. A category wants everything there
   * is, which is what the freeform page needs: it builds its controls from
   * whatever the chosen model declares rather than requiring a fixed shape.
   */
  /*
   * Resolved by capability, not read straight off the cookie.
   *
   * OpenAI does images only, so asking it for the video slots returns an empty
   * picker — which is exactly what happened the first time this shipped: the
   * Motion step offered nothing at all rather than Replicate's models. The
   * provider that will actually run the job is the one whose catalogue belongs
   * in the picker, and `providerFor` is the single answer to which that is.
   */
  const category = params.get("category");
  if (category) {
    if (!isOpenCategory(category)) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }
    const provider = await activeProvider(category.endsWith("-video") ? "video" : "image");
    try {
      return NextResponse.json(
        { category, provider, models: await categoryModels(category, provider), partial: false },
        { headers: { "Cache-Control": "private, max-age=300" } },
      );
    } catch {
      return NextResponse.json({ category, provider, models: [], partial: true });
    }
  }

  const slot = params.get("slot");
  if (!isModelSlotId(slot)) {
    return NextResponse.json({ error: `Unknown slot: ${slot}` }, { status: 400 });
  }

  const definition = MODEL_SLOTS[slot];
  const provider = await activeProvider(slotCapability(slot));

  try {
    const models = await compatibleModels(definition, provider);
    return NextResponse.json(
      { slot, provider, fallback: slotFallback(definition, provider), models, partial: false },
      // Let the browser reuse this for a few minutes; the server cache behind it
      // is measured in hours.
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    const fb = slotFallback(definition, provider);
    return NextResponse.json({
      slot,
      provider,
      fallback: fb,
      models: [
        {
          id: fb,
          title: fb,
          isDefault: true,
          supports: {
            resolution: true,
            duration: true,
            aspectRatio: true,
            audio: true,
            imageSize: true,
            numImages: true,
          },
        },
      ],
      partial: true,
    });
  }
}
