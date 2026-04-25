import { describe, expect, it } from "vitest";
import { matchesPath } from "./pathMatcher";

describe("matchesPath", () => {
  it("matches exact protected files", () => {
    expect(matchesPath(".env", ".env")).toBe(true);
    expect(matchesPath("src/.env", ".env")).toBe(false);
  });

  it("matches directory globs", () => {
    expect(matchesPath("src/auth/session.ts", "src/auth/**")).toBe(true);
    expect(matchesPath("src/ui/session.ts", "src/auth/**")).toBe(false);
  });

  it("matches file globs", () => {
    expect(matchesPath("src/config/app.json", "src/**/*.json")).toBe(true);
    expect(matchesPath("src/config/app.ts", "src/**/*.json")).toBe(false);
  });
});
