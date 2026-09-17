import "server-only";
import { cookies } from "next/headers";
import {
  LEGACY_PROVIDER_COOKIE, isProviderId, providerCookieFor, providerFor,
  type Capability, type ProviderId,
} from "@/lib/providers";

/**
 * Which provider serves this request, for the kind of work it is.
 *
 * Read from a cookie rather than passed on every call: the choice is a property
 * of the browser doing the work, and threading it through every fetch in the
 * client would mean a dozen call sites that could each forget.
 *
 * Every read goes through `providerFor`, so a stored choice that cannot do the
 * job — a browser holding "openai" for video, from before the split — resolves
 * to the default instead of failing at submit.
 */
export async function activeProvider(need: Capability): Promise<ProviderId> {
  const jar = await cookies();
  const own = jar.get(providerCookieFor(need))?.value;
  if (isProviderId(own)) return providerFor(own, need);

  /*
   * Nothing chosen for this capability yet. A browser that used the studio
   * before the split has one cookie covering both, and honouring it is kinder
   * than silently moving somebody to the new defaults — but only where it can
   * actually do the job, which is what providerFor settles.
   */
  const legacy = jar.get(LEGACY_PROVIDER_COOKIE)?.value;
  return providerFor(isProviderId(legacy) ? legacy : undefined, need);
}
