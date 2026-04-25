import { AgentShieldConfig, ChangedFile, CheckResult, RiskFinding, RiskLevel } from "./types";
import { matchesAnyPath } from "./pathMatcher";
import { detectUnrelatedFiles, listTasks } from "./tasks";
import { getGitChanges } from "../git/gitClient";

const riskOrder: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function levelFromScore(score: number): RiskLevel {
  if (score >= 90) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function isRiskAllowed(actual: RiskLevel, allowed: RiskLevel): boolean {
  return riskOrder.indexOf(actual) <= riskOrder.indexOf(allowed);
}

function isSensitivePath(file: string): boolean {
  if (/\.(md|mdx|txt)$/i.test(file)) {
    return false;
  }
  return /(^|\/)(auth|payment|payments|security|secrets?|session|token|permission|acl)(\/|\.|$)/i.test(file);
}

function isEnvOrConfig(file: string): boolean {
  return /(^|\/)\.env($|\.)|(^|\/)(app|agent|agentshield|next|vite|vitest|tsconfig|webpack|rollup|eslint|prettier|firebase)\.config\.[cm]?[jt]s$|(^|\/)(tsconfig(\.[^/]+)?\.json|firebase\.rules|vercel\.json|netlify\.toml|dockerfile|docker-compose\.ya?ml)$/i.test(file);
}

function isPackageChange(file: string): boolean {
  return /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(file);
}

export function scoreChangedFiles(
  changedFiles: ChangedFile[],
  config: AgentShieldConfig,
  unrelatedFiles: string[]
): { score: number; findings: RiskFinding[]; protectedWarnings: RiskFinding[] } {
  let score = 0;
  const findings: RiskFinding[] = [];
  const protectedWarnings: RiskFinding[] = [];

  for (const file of changedFiles) {
    if (matchesAnyPath(file.path, config.protectedPaths)) {
      const finding: RiskFinding = {
        level: isEnvOrConfig(file.path) ? "CRITICAL" : "HIGH",
        file: file.path,
        message: "Protected file changed",
        detail: "This path matches agentshield.config.json protectedPaths."
      };
      protectedWarnings.push(finding);
      findings.push(finding);
      score += finding.level === "CRITICAL" ? 45 : 30;
    }

    if (isSensitivePath(file.path)) {
      findings.push({
        level: "HIGH",
        file: file.path,
        message: "Sensitive auth/payment/security area changed"
      });
      score += 25;
    }

    if (isPackageChange(file.path)) {
      findings.push({
        level: "HIGH",
        file: file.path,
        message: "Package or dependency file changed"
      });
      score += 25;
    }

    if (isEnvOrConfig(file.path)) {
      findings.push({
        level: "HIGH",
        file: file.path,
        message: "Environment or deployment config changed"
      });
      score += 20;
    }

    if (file.isDeleted || file.deletions >= 80) {
      findings.push({
        level: file.isDeleted ? "CRITICAL" : "HIGH",
        file: file.path,
        message: file.isDeleted ? "File deletion detected" : "Large deletion detected",
        detail: `${file.deletions} deleted lines`
      });
      score += file.isDeleted ? 40 : 25;
    }

    if (file.additions + file.deletions >= 300) {
      findings.push({
        level: "HIGH",
        file: file.path,
        message: "Large unexplained refactor candidate",
        detail: `${file.additions + file.deletions} changed lines`
      });
      score += 25;
    }
  }

  for (const file of unrelatedFiles) {
    findings.push({
      level: "MEDIUM",
      file,
      message: "Changed file appears outside active task scope"
    });
    score += 15;
  }

  if (changedFiles.length >= 15) {
    findings.push({
      level: "HIGH",
      message: "Broad change set detected",
      detail: `${changedFiles.length} files changed`
    });
    score += 20;
  }

  return { score: Math.min(score, 100), findings, protectedWarnings };
}

export async function checkChanges(root: string, config: AgentShieldConfig): Promise<CheckResult> {
  const gitChanges = await getGitChanges(root);
  const tasks = await listTasks(root);
  const unrelatedFiles = detectUnrelatedFiles(
    gitChanges.changedFiles.map((file) => file.path),
    tasks
  );
  const scored = scoreChangedFiles(gitChanges.changedFiles, config, unrelatedFiles);

  return {
    risk: levelFromScore(scored.score),
    allowedRiskLevel: config.allowedRiskLevel,
    score: scored.score,
    changedFiles: gitChanges.changedFiles,
    findings: scored.findings,
    protectedWarnings: scored.protectedWarnings,
    unrelatedFiles,
    isGitRepo: gitChanges.isGitRepo
  };
}
