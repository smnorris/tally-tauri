import { describe, it, expect } from "vitest";
import { round2, fmtUSD, csvEscape, projectTint } from "../App.jsx";

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(2.3456)).toBe(2.35);
    expect(round2(2.344)).toBe(2.34);
  });

  it("fixes common floating point artifacts", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("leaves whole numbers unchanged", () => {
    expect(round2(5)).toBe(5);
  });
});

describe("fmtUSD", () => {
  it("formats whole dollar amounts without trailing decimals", () => {
    expect(fmtUSD(100)).toBe("$100");
  });

  it("keeps a single decimal place when present", () => {
    expect(fmtUSD(99.5)).toBe("$99.5");
  });

  it("adds thousands separators", () => {
    expect(fmtUSD(1234)).toBe("$1,234");
  });
});

describe("csvEscape", () => {
  it("returns plain strings unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("wraps values containing commas in quotes", () => {
    expect(csvEscape("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("escapes embedded double quotes by doubling them", () => {
    expect(csvEscape('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("wraps values containing newlines in quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("converts null and undefined to an empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("converts numbers to strings", () => {
    expect(csvEscape(42)).toBe("42");
  });
});

describe("projectTint", () => {
  it("appends the alpha suffix to a valid 6-digit hex color", () => {
    expect(projectTint("#8dd3c7")).toBe("#8dd3c766");
  });

  it("falls back to the default color for invalid input", () => {
    expect(projectTint("not-a-color")).toMatch(/^#[0-9a-fA-F]{6}66$/);
  });

  it("falls back to the default color when none is given", () => {
    expect(projectTint(undefined)).toMatch(/^#[0-9a-fA-F]{6}66$/);
  });
});
