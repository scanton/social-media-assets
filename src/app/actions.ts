"use server";

import { signOut } from "@/auth";

/** NextAuth v5 requires a CSRF-checked POST, so sign-out goes through a server action. */
export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}
