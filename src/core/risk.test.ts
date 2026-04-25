import { describe, expect, it } from "vitest";
import { AgentShieldConfig, ChangedFile } from "./types";
import { isRiskAllowed, scoreChangedFiles } from "./risk";

const config: AgentShieldConfig = {
  protectedPaths: [".env", "package.json", "src/auth/**"],
  allowedRiskLevel: "MEDIUM"
};

describe("risk scoring", () => {
  it("flags protected and dependency changes as high risk", () => {
    const changedFiles: ChangedFile[] = [
      { path: "package.json", status: "M", additions: 3, deletions: 1, isDeleted: false }
    ];

    const result = scoreChangedFiles(changedFiles, config, []);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.protectedWarnings[0].file).toBe("package.json");
  });

  it("flags env files as critical protected warnings", () => {
    const changedFiles: ChangedFile[] = [
      { path: ".env", status: "M", additions: 1, deletions: 0, isDeleted: false }
    ];

    const result = scoreChangedFiles(changedFiles, config, []);
    expect(result.protectedWarnings[0].level).toBe("CRITICAL");
  });

  it("compares allowed risk levels", () => {
    expect(isRiskAllowed("LOW", "MEDIUM")).toBe(true);
    expect(isRiskAllowed("HIGH", "MEDIUM")).toBe(false);
  });
});
