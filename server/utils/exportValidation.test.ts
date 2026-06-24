import { describe, it, expect } from "vitest";
import {
  validateHtmlContent,
  validateHtmlItems,
  validatePdfExportBody,
  MAX_HTML_BYTES,
  MAX_ITEMS,
} from "./exportValidation";

describe("validateHtmlContent", () => {
  it("accepts a normal HTML string", () => {
    expect(validateHtmlContent("<h1>Hello</h1>").ok).toBe(true);
  });

  it("rejects non-strings and empty strings", () => {
    expect(validateHtmlContent(undefined).ok).toBe(false);
    expect(validateHtmlContent("").ok).toBe(false);
    expect(validateHtmlContent(123).ok).toBe(false);
  });

  it("rejects content over the byte limit", () => {
    const tooBig = "a".repeat(MAX_HTML_BYTES + 1);
    const result = validateHtmlContent(tooBig);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maximum allowed size/);
  });
});

describe("validateHtmlItems", () => {
  it("accepts a small array of HTML strings", () => {
    expect(validateHtmlItems(["<p>1</p>", "<p>2</p>"]).ok).toBe(true);
  });

  it("rejects non-arrays and empty arrays", () => {
    expect(validateHtmlItems("nope").ok).toBe(false);
    expect(validateHtmlItems([]).ok).toBe(false);
  });

  it("rejects arrays with too many items", () => {
    const many = new Array(MAX_ITEMS + 1).fill("<p>x</p>");
    const result = validateHtmlItems(many);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Too many items/);
  });

  it("rejects arrays containing a non-string or empty item", () => {
    expect(validateHtmlItems(["<p>ok</p>", ""]).ok).toBe(false);
    expect(validateHtmlItems(["<p>ok</p>", 5]).ok).toBe(false);
  });

  it("rejects an oversized item", () => {
    const result = validateHtmlItems(["<p>ok</p>", "a".repeat(MAX_HTML_BYTES + 1)]);
    expect(result.ok).toBe(false);
  });
});

describe("validatePdfExportBody", () => {
  it("accepts a single html document", () => {
    expect(validatePdfExportBody({ html: "<h1>Hi</h1>" }).ok).toBe(true);
  });

  it("accepts an items array", () => {
    expect(validatePdfExportBody({ items: ["<p>1</p>"] }).ok).toBe(true);
  });

  it("rejects a body with neither html nor items", () => {
    const result = validatePdfExportBody({});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Missing content");
  });

  it("rejects when the provided html is oversized", () => {
    expect(validatePdfExportBody({ html: "a".repeat(MAX_HTML_BYTES + 1) }).ok).toBe(false);
  });
});
