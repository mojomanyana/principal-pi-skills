import { describe, expect, it } from "vitest";
import { authorizationStatus } from "./auth";

describe("authorizationStatus", () => {
  it("returns 401 for an unauthenticated caller", () => {
    expect(authorizationStatus({ authenticated: false })).toBe(401);
  });

  it("returns 200 for an admin", () => {
    expect(authorizationStatus({ authenticated: true, role: "admin" })).toBe(200);
  });
});
