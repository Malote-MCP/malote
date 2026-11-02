import { hasAcceptedCurrentTerms, PRIVACY_VERSION, TERMS_VERSION } from "@malote/db";
import { redirect } from "next/navigation";
import { TermsGate } from "@/components/account";
import { Dashboard } from "@/components/dashboard";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  // Covers e-mail and Google sign-ups alike, and asks again whenever either text gets a new version.
  if (!(await hasAcceptedCurrentTerms(db, user.id))) {
    return <TermsGate termsVersion={TERMS_VERSION} privacyVersion={PRIVACY_VERSION} />;
  }
  return <Dashboard name={user.name || user.email} enclaveUrl={process.env.ENCLAVE_URL ?? null} enclaveEnv={process.env.ENCLAVE_ENV ?? null} />;
}
