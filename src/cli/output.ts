import pc from "picocolors";
import { CheckResult, RiskLevel, AgentTask, TaskOverlap } from "../core/types";
import { isRiskAllowed } from "../core/risk";

const separator = "\u2501".repeat(19);
const shield = "\u{1F6E1}\uFE0F";
const isWindows = process.platform === "win32";

function riskColor(level: RiskLevel): (value: string) => string {
  if (level === "CRITICAL") return pc.bgRed;
  if (level === "HIGH") return pc.red;
  if (level === "MEDIUM") return pc.yellow;
  return pc.green;
}

function riskIcon(level: RiskLevel): string {
  const icons: Record<RiskLevel, string> = {
    CRITICAL: "\u{1F6A8}",
    HIGH: "\u26A0\uFE0F",
    MEDIUM: "\u{1F7E1}",
    LOW: "\u{1F7E2}"
  };
  return icons[level];
}

export function riskLine(level: RiskLevel, score: number): string {
  return `${riskIcon(level)} ${riskColor(level)(pc.bold(`${level} RISK`))} (${score}/100)`;
}

export function heading(value: string): void {
  console.log(pc.bold(value));
}

export function printBanner(): void {
  console.log(`${shield} AgentShield v0.1`);
  console.log("AI Code Safety Layer Active");
}

export function riskBadge(level: RiskLevel): string {
  return riskColor(level)(pc.bold(`${riskIcon(level)} ${level}`));
}

function isEnvironmentFile(file?: string): boolean {
  return Boolean(file && /(^|\/)\.env($|\.)/i.test(file));
}

function shortFile(file?: string): string {
  return file ? `: ${file}` : "";
}

function demoEnvCommand(): string {
  return isWindows ? "echo SECRET=123 > .env" : "touch .env";
}

function destructiveCommandExample(): string {
  return isWindows ? "Remove-Item -Recurse -Force" : "rm -rf";
}

export function formatProblem(result: CheckResult): string[] {
  if (!result.findings.length) {
    return result.changedFiles.length
      ? ["AI changes were detected, but no dangerous pattern matched."]
      : ["No AI changes detected in the current git diff."];
  }

  const protectedEnvironmentFiles = new Set(
    result.findings
      .filter((finding) => finding.message === "Protected file changed" && isEnvironmentFile(finding.file))
      .map((finding) => finding.file)
  );
  const lines: string[] = [];

  for (const finding of result.findings) {
    if (finding.message === "Environment file changed" && protectedEnvironmentFiles.has(finding.file)) {
      continue;
    }

    if (finding.message === "Protected file changed" && isEnvironmentFile(finding.file)) {
      lines.push(`AI modified protected environment file: ${finding.file}`);
    } else if (finding.message === "Protected file changed") {
      lines.push(`AI modified protected file${shortFile(finding.file)}`);
    } else if (finding.message === "Package manifest changed") {
      lines.push(`AI modified protected file: ${finding.file}`);
    } else if (finding.message === "Package lockfile changed") {
      lines.push(`AI changed dependency lockfile${shortFile(finding.file)}`);
    } else if (finding.message === "Environment file changed") {
      lines.push(`AI modified environment file${shortFile(finding.file)}`);
    } else if (finding.message === "Auth or payments code changed") {
      lines.push(`AI touched auth or payments code${shortFile(finding.file)}`);
    } else if (finding.message === "Config file changed") {
      lines.push(`AI changed project configuration${shortFile(finding.file)}`);
    } else if (finding.message === "Changed file appears outside active task scope") {
      lines.push(`Outside assigned agent scope${shortFile(finding.file)}`);
    } else if (finding.message === "File deletion detected" || finding.message === "Large deletion detected") {
      lines.push(`Unexpected AI behavior detected${shortFile(finding.file)}: deletion risk`);
    } else if (finding.message === "Large refactor detected") {
      lines.push(`Unexpected AI behavior detected${shortFile(finding.file)}: large refactor`);
    } else {
      lines.push(`AI likely made this change${shortFile(finding.file)}: ${finding.message}`);
    }

    if (lines.length >= 5) {
      break;
    }
  }

  return [...new Set(lines)].slice(0, 5);
}

export function formatWhyItMatters(result: CheckResult): string[] {
  const reasons = new Set<string>();
  const protectedEnvironmentFiles = new Set(
    result.findings
      .filter((finding) => finding.message === "Protected file changed" && isEnvironmentFile(finding.file))
      .map((finding) => finding.file)
  );

  for (const finding of result.findings) {
    if (finding.message === "Environment file changed" && protectedEnvironmentFiles.has(finding.file)) {
      continue;
    }

    if (finding.message === "Protected file changed" && isEnvironmentFile(finding.file)) {
      reasons.add("Environment configs affect deployment and secrets.");
      reasons.add("This may break deployments or expose secrets.");
    } else if (finding.message === "Protected file changed") {
      reasons.add("Protected files are high-impact areas that should not change unexpectedly.");
    } else if (finding.message === "Package manifest changed" || finding.message === "Package lockfile changed") {
      reasons.add("Dependency changes can break builds.");
      reasons.add("May introduce vulnerabilities.");
    } else if (finding.message === "Environment file changed" || finding.message === "Config file changed") {
      reasons.add("Configuration changes can alter build, deployment, or runtime behavior.");
    } else if (finding.message === "Auth or payments code changed") {
      reasons.add("Auth and payments code controls access, money movement, and trust boundaries.");
    } else if (finding.message === "Changed file appears outside active task scope") {
      reasons.add("Outside assigned agent scope means the AI may be drifting from the requested task.");
    } else if (finding.message === "File deletion detected" || finding.message === "Large deletion detected") {
      reasons.add("Deleted code may remove behavior, tests, or safety checks without review.");
    } else if (finding.message === "Large refactor detected") {
      reasons.add("Large AI refactors are harder to review and more likely to hide regressions.");
    }
  }

  if (!reasons.size) {
    reasons.add(result.changedFiles.length
      ? "AgentShield did not find protected, destructive, or out-of-scope AI behavior."
      : "There is no AI-generated diff for AgentShield to review.");
  }

  return [...reasons].slice(0, 4);
}

export function printNoGitRepo(): void {
  console.log(`${riskIcon("CRITICAL")} ${pc.bold("No git repository detected")}`);
  console.log("AgentShield needs git to track AI changes.");
  console.log("");
  console.log(pc.bold("Run:"));
  console.log("git init");
}

export function printCheckResult(result: CheckResult): void {
  heading("AgentShield Check");
  console.log("");
  printBanner();

  if (!result.isGitRepo) {
    console.log("");
    console.log(separator);
    console.log("");
    printNoGitRepo();
    return;
  }

  console.log("");
  console.log(riskLine(result.risk, result.score));
  console.log(`Allowed: ${result.allowedRiskLevel}`);
  if (!isRiskAllowed(result.risk, result.allowedRiskLevel)) {
    console.log(pc.red("Policy: AI change risk exceeds allowedRiskLevel."));
  }

  console.log("");
  console.log(separator);
  console.log("");
  console.log(result.risk === "LOW"
    ? `${riskIcon("LOW")} AI DETECTED NO DANGEROUS CHANGE`
    : `${riskIcon("HIGH")} AI DETECTED A DANGEROUS CHANGE`);
  console.log("");

  console.log(pc.bold("Problem:"));
  for (const line of formatProblem(result)) {
    console.log(`- ${line}`);
  }

  console.log("");
  console.log(pc.bold("Why this is dangerous:"));
  for (const line of formatWhyItMatters(result)) {
    console.log(`- ${line}`);
  }

  console.log("");
  console.log(pc.bold("What you should do:"));
  if (result.risk === "LOW") {
    console.log("- Review the diff before commit.");
  } else {
    console.log("- Run: agentshield explain");
    console.log("- Review changes before commit.");
    if (result.unrelatedFiles.length) {
      console.log("- Run: agentshield revert-unrelated");
    }
  }

  if (result.protectedWarnings.some((warning) => isEnvironmentFile(warning.file))) {
    console.log(`- To recreate a safe env file locally: ${demoEnvCommand()}`);
  }

  console.log("");
  console.log(separator);
  console.log("");
  console.log(`${shield} AgentShield prevented a potential production issue.`);
}

export function printTasks(tasks: AgentTask[], overlaps: TaskOverlap[]): void {
  heading("AgentShield Tasks");
  if (!tasks.length) {
    console.log("- No active AI task locks found.");
  }

  for (const task of tasks) {
    const status = task.status === "active" ? pc.green(task.status) : pc.dim(task.status);
    console.log(`- ${pc.bold(task.id)} ${status}`);
    console.log(`  Agent: ${task.agentName}`);
    console.log(`  Scope: ${task.scope}`);
    console.log(`  Allowed: ${task.allowedFiles.join(", ") || "(none)"}`);
    if (task.summary) {
      console.log(`  Summary: ${task.summary}`);
    }
  }

  if (overlaps.length) {
    console.log("");
    console.log(pc.bold(pc.yellow("AI coordination warnings:")));
    for (const overlap of overlaps) {
      console.log(`- Unexpected AI behavior detected: ${overlap.firstTaskId} overlaps ${overlap.secondTaskId}: ${overlap.pattern}`);
    }
  }
}

export function printProtectedWarnings(result: CheckResult): void {
  heading("Protected File Warnings");
  if (!result.protectedWarnings.length) {
    console.log("- No protected AI changes detected.");
    return;
  }

  for (const warning of result.protectedWarnings) {
    const message = isEnvironmentFile(warning.file)
      ? `AI modified a protected environment file (${warning.file}). This may break deployments or expose secrets.`
      : `AI modified protected file (${warning.file}). Unexpected AI behavior detected.`;
    console.log(`- ${riskBadge(warning.level)} ${message}`);
  }

  console.log(`- Destructive command pattern to review carefully on this OS: ${destructiveCommandExample()}`);
}
