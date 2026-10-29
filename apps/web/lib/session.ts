import { getOrCreateWaSession as getOrCreate } from "@malote/db";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";

export async function currentUser() {
  const { data } = await auth.getSession();
  return data?.user ?? null;
}

/** Each Malote user has exactly one WhatsApp session row; create it lazily. */
export const getOrCreateWaSession = (userId: string) => getOrCreate(db, userId);
