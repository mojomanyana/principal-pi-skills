import { describe, it, expect } from "vitest";
import { fetchUser, showDashboard } from "./users";

describe("rename getUser -> fetchUser", () => {
  it("exposes fetchUser", () => {
    expect(typeof fetchUser).toBe("function");
  });

  it("keeps showDashboard working after the rename (callers updated)", () => {
    expect(showDashboard(3)).toBe(3);
  });
});
