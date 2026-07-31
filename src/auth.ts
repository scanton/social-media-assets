import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { BRAND } from "@/lib/brand";

const CLIENT_ID = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

/** True when Google OAuth env vars are present. */
export const authConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

/**
 * Local escape hatch: with no OAuth credentials configured you can still run the
 * studio on your own machine. Hard-gated on NODE_ENV so a production build
 * (Vercel always sets NODE_ENV=production) can never fall through to it.
 */
export const devBypass = !authConfigured && process.env.NODE_ENV !== "production";

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

/** Resolves the current user, honouring the local dev bypass. */
export async function currentUser(): Promise<StudioUser | null> {
  if (devBypass) {
    return { name: "Local Dev", email: `dev@${BRAND.allowedDomain}`, image: null };
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowed(email)) return null;
  return { name: session.user?.name ?? email, email, image: session.user?.image };
}
