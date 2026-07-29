export interface Session {
  handle: string;
  userId: string;
  expiresAt: number;
}

const store = new Map<string, Session>();

export async function getSession(handle: string): Promise<Session | undefined> {
  return store.get(handle);
}

export async function putSession(s: Session): Promise<void> {
  store.set(s.handle, s);
}
