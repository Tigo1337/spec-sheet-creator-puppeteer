import { describe, it, expect } from "vitest";
import { normalizeEmail, buildDynamicPrompt } from "./helpers";

describe("normalizeEmail", () => {
  it("lowercases all addresses", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("strips dots and +suffix for gmail addresses", () => {
    expect(normalizeEmail("john.doe+spam@gmail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("j.o.h.n@googlemail.com")).toBe("john@googlemail.com");
  });

  it("does not strip dots for non-gmail domains", () => {
    expect(normalizeEmail("john.doe@company.com")).toBe("john.doe@company.com");
  });
});

describe("buildDynamicPrompt", () => {
  it("produces marketing instructions for the marketing type", () => {
    const prompt = buildDynamicPrompt({ type: "marketing" });
    expect(prompt).toMatch(/marketing description/i);
  });

  it("appends tone for content types that support it", () => {
    const prompt = buildDynamicPrompt({ type: "marketing", tone: "Playful" });
    expect(prompt).toMatch(/Tone: Playful/);
  });

  it("does not append tone for formatting types like uppercase", () => {
    const prompt = buildDynamicPrompt({ type: "uppercase", tone: "Playful" });
    expect(prompt).not.toMatch(/Tone: Playful/);
  });

  it("honors currency placement and symbol", () => {
    const prompt = buildDynamicPrompt({
      type: "currency",
      currencySymbol: "€",
      currencyPlacement: "after",
    });
    expect(prompt).toContain("€");
    expect(prompt).toMatch(/AFTER the number/);
  });

  it("uses custom instructions for the custom type", () => {
    const prompt = buildDynamicPrompt({ type: "custom", customInstructions: "Do the thing" });
    expect(prompt).toMatch(/Do the thing/);
  });

  it("always appends the critical formatting rules", () => {
    const prompt = buildDynamicPrompt({ type: "marketing" });
    expect(prompt).toMatch(/CRITICAL FORMATTING RULES/);
  });
});
