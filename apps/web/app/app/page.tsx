import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  return <Dashboard name={user.name || user.email} enclaveUrl={process.env.ENCLAVE_URL ?? null} enclaveEnv={process.env.ENCLAVE_ENV ?? null} />;
}
