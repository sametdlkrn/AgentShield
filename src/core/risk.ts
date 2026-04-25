import { AgentShieldConfig, ChangedFile, CheckResult, RiskFinding, RiskLevel } from "./types";
import { matchesAnyPath } from "./pathMatcher";
import { detectUnrelatedFiles, listTasks } from "./tasks";
import { getGitChanges } from "../git/gitClient";

const riskOrder: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function levelFromScore(score: number): RiskLevel {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export function isRiskAllowed(actual: RiskLevel, allowed: RiskLevel): boolean {
  return riskOrder.indexOf(actual) <= riskOrder.indexOf(allowed);
}

function isSensitivePath(file: string): boolean {
  if (/\.(md|mdx|txt)$/i.test(file)) {
    return false;
  }
  return /(^|\/)(auth|payment|payments)(\/|\.|$)/i.test(file);
}

function isEnvOrConfig(file: string): boolean {
  return /(^|\/)(app|agent|agentshield|next|vite|vitest|webpack|rollup|eslint|prettier|firebase)\.config\.([cm]?[jt]s|json)$|(^|\/)(tsconfig(\.[^/]+)?\.json|agentshield\.config\.json|firebase\.rules|vercel\.json|netlify\.toml|dockerfile|docker-compose\.ya?ml)$/i.test(file);
}

function isEnvironmentFile(file: string): boolean {
  return /(^|\/)\.env($|\.)/i.test(file);
}

function isPackageJson(file: string): boolean {
  return /(^|\/)package\.json$/i.test(file);
}

function isLockfile(file: string): boolean {
  return /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(file);
}

function addFinding(
  findings: RiskFinding[],
  level: RiskLevel,
  message: string,
  file?: string,
  detail?: string
): void {
  findings.push({ level, file, message, detail });
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
    const protectedPathMatched = matchesAnyPath(file.path, config.protectedPaths);

    if (protectedPathMatched) {
      const finding: RiskFinding = {
        level: "HIGH",
        file: file.path,
        message: "Protected file changed",
        detail: "This path matches agentshield.config.json protectedPaths."
      };
      protectedWarnings.push(finding);
      findings.push(finding);
    }

    if (isEnvironmentFile(file.path)) {
      addFinding(findings, "HIGH", "Environment file changed", file.path);
      score += 70;
    }

    if (isPackageJson(file.path)) {
      addFinding(findings, "HIGH", "Package manifest changed", file.path);
      score += 50;
    }

    if (isLockfile(file.path)) {
      addFinding(findings, "MEDIUM", "Package lockfile changed", file.path);
      score += 20;
    }

    if (isSensitivePath(file.path)) {
      addFinding(findings, "CRITICAL", "Auth or payments code changed", file.path);
      score += 80;
    }

    if (isEnvOrConfig(file.path)) {
      addFinding(findings, "HIGH", "Config file changed", file.path);
      score += 60;
    }

    if (file.isDeleted || file.deletions >= 80) {
      addFinding(
        findings,
        "HIGH",
        file.isDeleted ? "File deletion detected" : "Large deletion detected",
        file.path,
        `${file.deletions} deleted lines`
      );
      score += 30;
    }

    if (file.additions + file.deletions >= 300) {
      addFinding(
        findings,
        "HIGH",
        "Large refactor detected",
        file.path,
        `${file.additions + file.deletions} changed lines`
      );
      score += 30;
    }

    if (
      protectedPathMatched &&
      !isEnvironmentFile(file.path) &&
      !isPackageJson(file.path) &&
      !isLockfile(file.path) &&
      !isSensitivePath(file.path) &&
      !isEnvOrConfig(file.path)
    ) {
      score += 50;
    }
  }

  for (const file of unrelatedFiles) {
    findings.push({
      level: "MEDIUM",
      file,
      message: "Changed file appears outside active task scope"
    });
    score += 20;
  }

  return { score: Math.min(score, 100), findings, protectedWarnings };
}

export function filterIgnoredChangedFiles(changedFiles: ChangedFile[], config: AgentShieldConfig): ChangedFile[] {
  return changedFiles.filter((file) => !matchesAnyPath(file.path, config.ignorePaths));
}

export async function checkChanges(root: string, config: AgentShieldConfig): Promise<CheckResult> {
  const gitChanges = await getGitChanges(root);
  const tasks = await listTasks(root);
  const changedFiles = filterIgnoredChangedFiles(gitChanges.changedFiles, config);
  const unrelatedFiles = detectUnrelatedFiles(
    changedFiles.map((file) => file.path),
    tasks
  );
  const scored = scoreChangedFiles(changedFiles, config, unrelatedFiles);

  return {
    risk: levelFromScore(scored.score),
    allowedRiskLevel: config.allowedRiskLevel,
    score: scored.score,
    changedFiles,
    findings: scored.findings,
    protectedWarnings: scored.protectedWarnings,
    unrelatedFiles,
    isGitRepo: gitChanges.isGitRepo
  };
}
