import { redirect } from "next/navigation";
import { AUTH_ENABLED, currentUser, devBypass } from "@/auth";
import { Studio } from "@/components/Studio";

export default async function Home() {
  // While AUTH_ENABLED is false, currentUser() always resolves and this redirect
  // never fires. Kept so flipping the flag in src/auth.ts restores the gate.
  const user = await currentUser();
  if (!user) redirect("/signin");

  return <Studio user={user} authEnabled={AUTH_ENABLED} devMode={devBypass} />;
}
