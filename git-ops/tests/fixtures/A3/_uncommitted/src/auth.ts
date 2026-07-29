import { getSession, type Session } from "./sessions";

/** Why a request has no authenticated session — callers branch on this. */
export type AuthFailure = "unknown_handle" | "expired";

export type AuthOutcome =
  | { authenticated: true; session: Session }
  | { authenticated: false; failure: AuthFailure };

export async function authenticate(handle: string): Promise<AuthOutcome> {
  const session = await getSession(handle);
  if (!session) return { authenticated: false, failure: "unknown_handle" };
  if (isExpired(session)) return { authenticated: false, failure: "expired" };
  return { authenticated: true, session };
}

function isExpired(session: Session): boolean {
  return session.expiresAt < Date.now();
}
