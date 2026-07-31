import { AUTH_ENABLED, handlers } from "@/auth";

/*
 * With AUTH_ENABLED off there is no provider and no AUTH_SECRET, so hand back a
 * clean 404 instead of letting NextAuth throw on stray crawler hits.
 */
const disabled = () => new Response("Not found", { status: 404 });

export const GET = AUTH_ENABLED ? handlers.GET : disabled;
export const POST = AUTH_ENABLED ? handlers.POST : disabled;
