import { createToken as create, verifyToken as verify } from "@malote/db";
import { db } from "@/lib/db";

export { NeedsAuthorization } from "@malote/db";

export const createToken = (userId: string, name: string, opts: { authorizeWith?: string; reset?: boolean } = {}) =>
  create(db, userId, name, opts);

export const verifyToken = (token: string) => verify(db, token);
