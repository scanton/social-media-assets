import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_PROVIDER, PROVIDER_COOKIE, isProviderId, type ProviderId } from "@/lib/providers";

/**
 * Which provider this request runs against.
 *
 * Read from a cookie rather than passed on every call: the choice is a property
 * of the browser doing the work, and threading it through every fetch in the
 * client would mean a dozen call sites that could each forget. A request that
 * arrives before the cookie has ever been set gets fal, which is where the
 * studio started.
 */
export async function activeProvider(): Promise<ProviderId> {
  const jar = await cookies();
  const v = jar.get(PROVIDER_COOKIE)?.value;
  return isProviderId(v) ? v : DEFAULT_PROVIDER;
}
