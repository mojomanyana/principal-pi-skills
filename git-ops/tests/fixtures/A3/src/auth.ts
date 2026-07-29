import { getSession, type Session } from "./sessions";

export async function authenticate(handle: string): Promise<Session | null> {
  const session = await getSession(handle);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}
