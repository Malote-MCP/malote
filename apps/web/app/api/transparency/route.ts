import { workers } from "@malote/db";
import { desc, gt } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const REPO = process.env.SOURCE_REPO ?? null;

/**
 * Public: which build is running. Each image is built by CI from a public commit and has a signed
 * provenance attestation, so anyone can check the digest below against the source (see /seguranca).
 * This is reported by the servers themselves; see /seguranca for what that does and does not prove.
 */
export async function GET() {
  const live = await db
    .select({ imageRef: workers.imageRef, gitSha: workers.gitSha, startedAt: workers.startedAt, seenAt: workers.seenAt })
    .from(workers)
    .where(gt(workers.seenAt, new Date(Date.now() - 5 * 60_000)))
    .orderBy(desc(workers.seenAt));
  return Response.json({
    source: REPO,
    web: { imageRef: process.env.FLY_IMAGE_REF ?? null, gitSha: process.env.GIT_SHA ?? null },
    workers: live,
  });
}
