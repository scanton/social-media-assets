import { redirect } from "next/navigation";
import { currentUser, devBypass } from "@/auth";
import { Studio } from "@/components/Studio";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/signin");

  return <Studio user={user} devMode={devBypass} />;
}
