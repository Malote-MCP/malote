import {
  ensureBilling,
  hasAcceptedCurrentTerms,
  hasAccessRow,
  PRIVACY_VERSION,
  referralStats,
  rewardReferrals,
  TERMS_VERSION,
} from "@malote/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TermsGate } from "@/components/account";
import type { BillingView } from "@/components/billing";
import { Dashboard } from "@/components/dashboard";
import { asaasConfigured } from "@/lib/asaas";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ pagamento?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  // Covers e-mail and Google sign-ups alike, and asks again whenever either text gets a new version.
  if (!(await hasAcceptedCurrentTerms(db, user.id))) {
    return <TermsGate termsVersion={TERMS_VERSION} privacyVersion={PRIVACY_VERSION} />;
  }
  const ref = (await cookies()).get("malote_ref")?.value ?? null;
  await ensureBilling(db, user.id, ref);
  await rewardReferrals(db, user.id).catch(() => 0);
  const row = await ensureBilling(db, user.id);
  const publicUrl = process.env.PUBLIC_URL ?? "https://malote.io";
  const billing: BillingView = {
    status: row.status,
    plan: row.plan,
    freeForever: row.freeForever,
    hasAccess: hasAccessRow(row),
    accessUntil: row.accessUntil?.toISOString() ?? null,
    trialEndsAt: row.trialEndsAt.toISOString(),
    hasSubscription: Boolean(row.asaasSubscriptionId),
    referralLink: `${publicUrl}/auth/sign-up?ref=${row.referralCode}`,
    referrals: await referralStats(db, user.id),
    bonusDays: row.bonusDays,
    paymentsEnabled: asaasConfigured(),
    notice: (await searchParams).pagamento ?? null,
  };
  return (
    <Dashboard
      name={user.name || user.email}
      enclaveUrl={process.env.ENCLAVE_URL ?? null}
      enclaveEnv={process.env.ENCLAVE_ENV ?? null}
      billing={billing}
    />
  );
}
