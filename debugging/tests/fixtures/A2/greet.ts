import { formatUser } from "./format";

export const users = [
  { id: 1, name: "Ann" },
  { id: 2, name: "Bo" },
];

export function greet(id: number): string {
  const u = users.find((x) => x.id === id);
  return "Hi " + formatUser(u as { name: string }); // crashes when no match is found
}
