import { describe, expect, it } from "vitest";
import { AgentShieldConfig, ChangedFile } from "./types";
import { filterIgnoredChangedFiles, isRiskAllowed, scoreChangedFiles } from "./risk";

const config: AgentShieldConfig = {
  protectedPaths: [".env", "package.json", "src/auth/**"],
  ignorePaths: ["node_modules/**", ".git/**", "dist/**", "build/**", ".next/**"],
  allowedRiskLevel: "MEDIUM"
};

describe("risk scoring", () => {
  it("scores package manifests with the weighted model", () => {
    const changedFiles: ChangedFile[] = [
      { path: "package.json", status: "M", additions: 3, deletions: 1, isDeleted: false }
    ];

    const result = scoreChangedFiles(changedFiles, config, []);
    expect(result.score).toBe(50);
    expect(result.protectedWarnings[0].file).toBe("package.json");
  });

  it("scores env files as high risk without making critical common", () => {
    const changedFiles: ChangedFile[] = [
      { path: ".env", status: "M", additions: 1, deletions: 0, isDeleted: false }
    ];

    const result = scoreChangedFiles(changedFiles, config, []);
    expect(result.score).toBe(70);
    expect(result.protectedWarnings[0].level).toBe("HIGH");
  });

  it("compares allowed risk levels", () => {
    expect(isRiskAllowed("LOW", "MEDIUM")).toBe(true);
    expect(isRiskAllowed("HIGH", "MEDIUM")).toBe(false);
  });

  it("filters ignored noise files before scoring and explanations", () => {
    const changedFiles: ChangedFile[] = [
      { path: "node_modules/pkg/index.js", status: "M", additions: 1, deletions: 0, isDeleted: false },
      { path: "dist/index.js", status: "M", additions: 1, deletions: 0, isDeleted: false },
      { path: "src/auth/session.ts", status: "M", additions: 1, deletions: 0, isDeleted: false }
    ];

    expect(filterIgnoredChangedFiles(changedFiles, config).map((file) => file.path)).toEqual(["src/auth/session.ts"]);
  });
});
