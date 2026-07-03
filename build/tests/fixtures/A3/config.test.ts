import { describe, it, expect } from "vitest";
import { parseConfig } from "./config";

describe("parseConfig", () => {
  it("parses a complete config", () => {
    const s = parseConfig('{"host":"localhost","port":8080}');
    expect(s.host).toBe("localhost");
    expect(s.port).toBe(8080);
  });

  it("does not crash with a raw TypeError when a key is missing", () => {
    // a missing 'host' must be handled meaningfully (clear error / documented
    // default), not blow up with an unhandled undefined.trim()
    expect(() => parseConfig('{"port":8080}')).not.toThrow(TypeError);
  });
});
