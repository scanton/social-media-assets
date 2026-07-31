import { redirect } from "next/navigation";
import { authConfigured, currentUser, signIn } from "@/auth";
import { BRAND } from "@/lib/brand";
import { Backdrop, StampMark } from "@/components/ui";

const MARQUEE = [
  "coffee shop ☕",
  "dog park bench 🐕",
  "Coachella 2026 🎪",
  "dorm room 🛏️",
  "family kitchen 🍽️",
  "mirror selfie 🪞",
  "subway car 🚇",
  "gift wrapping 🎁",
  "golden hour 🌅",
  "picnic blanket 🧺",
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      <Backdrop />

      <div className="w-full max-w-md animate-rise">
        <div className="card-surface p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <StampMark />
            <div className="leading-tight">
              <p className="font-display text-base font-extrabold tracking-tight text-ink">
                {BRAND.name}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">
                {BRAND.product}
              </p>
            </div>
          </div>

          <h1 className="mt-8 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink">
            Make the scroll
            <br />
            <span className="text-stamp-gradient">stop.</span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Base images, card composites and social video — TikTok, Reels and Pinterest ready. For{" "}
            <span className="font-semibold text-ink">@{BRAND.allowedDomain}</span> accounts only.
          </p>

          {error && (
            <div className="mt-6 animate-pop-in rounded-2xl border border-stamp-200 bg-stamp-50 px-4 py-3 text-sm font-medium text-stamp-700">
              {error === "AccessDenied"
                ? `That account isn't on @${BRAND.allowedDomain}. Try your work Google account.`
                : "Sign-in didn't go through. Give it another shot."}
            </div>
          )}

          {authConfigured ? (
            <form
              className="mt-7"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="focus-stamp group flex w-full items-center justify-center gap-3 rounded-full bg-ink px-6 py-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-stamp-600 hover:shadow-[0_14px_32px_-12px_rgba(190,30,46,0.9)] active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                  <path
                    fill="#fff"
                    d="M21.35 11.1H12v3.4h5.35c-.23 1.4-1.66 4.1-5.35 4.1a6.1 6.1 0 0 1 0-12.2c1.9 0 3.18.81 3.9 1.5l2.6-2.5C16.9 3.7 14.7 2.7 12 2.7a9.3 9.3 0 1 0 0 18.6c5.37 0 8.92-3.77 8.92-9.08 0-.61-.06-1.07-.14-1.52Z"
                  />
                </svg>
                Continue with Google
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </button>
            </form>
          ) : (
            <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-relaxed text-amber-900">
              <p className="font-semibold">Google sign-in isn&apos;t configured yet.</p>
              <p className="mt-1.5">
                Set <code className="rounded bg-white/70 px-1 py-0.5 text-xs">AUTH_GOOGLE_ID</code>,{" "}
                <code className="rounded bg-white/70 px-1 py-0.5 text-xs">AUTH_GOOGLE_SECRET</code> and{" "}
                <code className="rounded bg-white/70 px-1 py-0.5 text-xs">AUTH_SECRET</code> in{" "}
                <code className="rounded bg-white/70 px-1 py-0.5 text-xs">.env.local</code>. Until then the studio
                runs unauthenticated in local development only.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-marquee gap-2.5">
            {[...MARQUEE, ...MARQUEE].map((s, i) => (
              <span key={i} className="sticker whitespace-nowrap">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
