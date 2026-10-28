import { getSessionByUserId, waSessions } from "@malote/db";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";

export async function currentUser() {
  const { data } = await auth.getSession();
  return data?.user ?? null;
}

/** Each Malote user has exactly one WhatsApp session row; create it lazily. */
export async function getOrCreateWaSession(userId: string) {
  const existing = await getSessionByUserId(db, userId);
  if (existing) return existing;
  await db.insert(waSessions).values({ userId }).onConflictDoNothing();
  return (await getSessionByUserId(db, userId))!;
}
