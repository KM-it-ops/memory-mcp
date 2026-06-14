import { timingSafeEqual } from "node:crypto";

/**
 * Bearer-token check for the HTTP transport. stdio needs no auth (local,
 * trusted); an HTTP endpoint exposed on a port does. Fails closed: if the
 * server has no token configured, nobody is authorized.
 */
export type AuthResult = { ok: true } | { ok: false; status: number; message: string };

const DENY: AuthResult = { ok: false, status: 401, message: "Unauthorized" };

export function authorize(authHeader: string | undefined, expectedToken: string): AuthResult {
  if (!expectedToken) return DENY; // no token configured -> deny everyone
  if (!authHeader) return DENY;

  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return DENY;

  const provided = authHeader.slice(prefix.length);
  return constantTimeEqual(provided, expectedToken) ? { ok: true } : DENY;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual requires equal lengths; a length mismatch is already a
  // non-match (the length itself is not secret).
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
