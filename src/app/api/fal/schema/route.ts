import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { activeProvider } from "@/lib/active-provider";
import { fetchInputSchema, isModelInOpenCategory } from "@/lib/model-catalog";

/**
 * One model's input schema.
 *
 * The freeform page draws its controls from this rather than from a fixed list,
 * which is the whole point of it: a model that takes a `guidance_scale` and a
 * `negative_prompt` should offer them, and one that does not should not pretend.
 *
 * Fetched on demand, not with the model list. A category has around 200 models
 * and the schema only matters once someone has chosen one.
 */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const model = new URL(req.url).searchParams.get("model");
  if (!model) return NextResponse.json({ error: "No model given" }, { status: 400 });

  // The same guard the submit route uses: a schema lookup is cheap, but an
  // open lookup over every fal endpoint is still an open proxy.
  if (!(await isModelInOpenCategory(model, await activeProvider()))) {
    return NextResponse.json({ error: `${model} is not an image or video model` }, { status: 400 });
  }

  const schema = await fetchInputSchema(model, await activeProvider());
  if (!schema) return NextResponse.json({ error: "That model has no readable schema" }, { status: 502 });

  return NextResponse.json(
    { model, schema },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
