export type User = { authenticated: boolean; role?: "admin" | "member" };

export function authorizationStatus(user: User): number {
  if (!user.authenticated) return 401;
  if (user.role === "admin") return 200;
  return 200;
}
