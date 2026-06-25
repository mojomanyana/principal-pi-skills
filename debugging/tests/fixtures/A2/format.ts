export function formatUser(u: { name: string }): string {
  return u.name.toUpperCase(); // throws when u is undefined
}
