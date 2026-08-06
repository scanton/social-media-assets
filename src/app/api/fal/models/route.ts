import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { compatibleModels } from "@/lib/model-catalog";
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

  const slot = new URL(req.url).searchParams.get("slot");
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
