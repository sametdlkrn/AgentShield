import { CheckResult } from "./types";

export function explainCheck(result: CheckResult): string[] {
  if (!result.isGitRepo) {
    return ["This folder is not a git repository, so AgentShield cannot analyze a diff yet."];
  }

  if (!result.changedFiles.length) {
    return ["No git changes were detected."];
  }

  if (!result.findings.length) {
    return ["Only low-risk changes were detected by deterministic checks."];
  }

  return result.findings.map((finding) => {
    const prefix = finding.file ? `${finding.file}: ` : "";
    const detail = finding.detail ? ` (${finding.detail})` : "";
    return `${prefix}${finding.message}${detail}`;
  });
}
