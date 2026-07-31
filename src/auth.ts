import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { BRAND } from "@/lib/brand";

/* ============================================================================
 * AUTHENTICATION IS CURRENTLY OFF.
 *
 * The studio runs as an open demo. That's deliberate: every user supplies their
 * own fal.ai key, so there is no spend, no stored secret and no data of ours to
 * expose. The key is the real gate.
 *
 * The whole Google / @heartstamp.com implementation below is intact and still
 * type-checked — nothing has been deleted. To turn it back on:
 *
 *   1. Flip AUTH_ENABLED to true.
 *   2. Set AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (see .env.example).
 *   3. Add <origin>/api/auth/callback/google to the Google OAuth client.
 *
 * Everything else — the sign-in page, the domain check, the per-route guards in
 * src/app/api/** — starts working again from that one flag.
 * ========================================================================== */
// Annotated as `boolean`, not the literal `false`, so TypeScript keeps both
// branches live and flipping this stays a one-character change.
export const AUTH_ENABLED: boolean = false;

const CLIENT_ID = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

/** True when auth is on AND Google OAuth env vars are present. */
export const authConfigured = AUTH_ENABLED && Boolean(CLIENT_ID && CLIENT_SECRET);

/**
 * Local escape hatch for when auth is switched back on but credentials aren't
 * set yet. Hard-gated on NODE_ENV so a production build (Vercel always sets
 * NODE_ENV=production) can never fall through to it.
 */
export const devBypass = AUTH_ENABLED && !authConfigured && process.env.NODE_ENV !== "production";

function isAllowed(email?: string | null, hd?: unknown): boolean {
  const domain = BRAND.allowedDomain.toLowerCase();
  if (typeof hd === "string" && hd.toLowerCase() === domain) return true;
  return Boolean(email && email.toLowerCase().endsWith(`@${domain}`));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: authConfigured
    ? [
        Google({
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          authorization: {
            params: {
              // Nudges Google's account chooser toward the Workspace domain.
              // Not a security control on its own — the callback below is.
              hd: BRAND.allowedDomain,
              prompt: "select_account",
            },
          },
        }),
      ]
    : [],
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    async signIn({ profile }) {
      const p = profile as { email?: string; email_verified?: boolean; hd?: string } | undefined;
      if (!p) return false;
      if (p.email_verified === false) return false;
      return isAllowed(p.email, p.hd);
    },
    async session({ session }) {
      return session;
    },
  },
});

export type StudioUser = {
  name: string;
  email: string;
  image?: string | null;
};

const GUEST: StudioUser = { name: "Guest", email: "", image: null };

/**
 * Resolves the current user.
 *
 * While AUTH_ENABLED is false this always succeeds, which turns the
 * `if (!(await currentUser())) return 401` guards in the API routes into no-ops
 * without having to edit — and later un-edit — every route.
 */
export async function currentUser(): Promise<StudioUser | null> {
  if (!AUTH_ENABLED) return GUEST;
  if (devBypass) {
    return { name: "Local Dev", email: `dev@${BRAND.allowedDomain}`, image: null };
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowed(email)) return null;
  return { name: session.user?.name ?? email, email, image: session.user?.image };
}
