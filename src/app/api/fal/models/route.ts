import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { categoryModels, compatibleModels, isOpenCategory } from "@/lib/model-catalog";
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
  const category = params.get("category");
  if (category) {
    if (!isOpenCategory(category)) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }
    try {
      return NextResponse.json(
        { category, models: await categoryModels(category), partial: false },
        { headers: { "Cache-Control": "private, max-age=300" } },
      );
    } catch {
      return NextResponse.json({ category, models: [], partial: true });
    }
  }

  const slot = params.get("slot");
  if (!isModelSlotId(slot)) {
    return NextResponse.json({ error: `Unknown slot: ${slot}` }, { status: 400 });
  }

  const definition = MODEL_SLOTS[slot];

  try {
    const models = await compatibleModels(definition);
    return NextResponse.json(
      { slot, fallback: definition.fallback, models, partial: false },
      // Let the browser reuse this for a few minutes; the server cache behind it
      // is measured in hours.
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json({
      slot,
      fallback: definition.fallback,
      models: [
        {
          id: definition.fallback,
          title: definition.fallback,
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
