import { describe, it, expect } from "vitest";
import { sanitizeData } from "./logger";

describe("sanitizeData", () => {
  it("returns primitives unchanged", () => {
    expect(sanitizeData("hi")).toBe("hi");
    expect(sanitizeData(42)).toBe(42);
    expect(sanitizeData(null)).toBe(null);
  });

  it("truncates long strings (e.g. base64 payloads)", () => {
    const long = "x".repeat(600);
    const result = sanitizeData({ image: long });
    expect(result.image).toMatch(/\[Truncated 600 chars\]/);
    expect(result.image.length).toBeLessThan(long.length);
  });

  it("leaves short strings intact", () => {
    const result = sanitizeData({ name: "Acme" });
    expect(result.name).toBe("Acme");
  });

  it("recurses into nested objects", () => {
    const result = sanitizeData({ outer: { blob: "y".repeat(600) } });
    expect(result.outer.blob).toMatch(/\[Truncated 600 chars\]/);
  });

  it("does not mutate the original object", () => {
    const original = { blob: "z".repeat(600) };
    sanitizeData(original);
    expect(original.blob.length).toBe(600);
  });
});
