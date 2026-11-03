import { currentUser } from "@/lib/session";

/** Operators, by e-mail, from ADMIN_EMAILS (comma-separated). Empty means nobody. */
const admins = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function currentAdmin() {
  const user = await currentUser();
  if (!user?.email || !admins().includes(user.email.toLowerCase())) return null;
  return user;
}
