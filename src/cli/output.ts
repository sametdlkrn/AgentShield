import pc from "picocolors";
import { CheckResult, RiskLevel, AgentTask, TaskOverlap } from "../core/types";
import { explainCheck } from "../core/explain";
import { isRiskAllowed } from "../core/risk";

function riskColor(level: RiskLevel): (value: string) => string {
  if (level === "CRITICAL") return pc.bgRed;
  if (level === "HIGH") return pc.red;
  if (level === "MEDIUM") return pc.yellow;
  return pc.green;
}

export function heading(value: string): void {
  console.log(pc.bold(value));
}

export function riskBadge(level: RiskLevel): string {
  return riskColor(level)(pc.bold(level));
}

export function printCheckResult(result: CheckResult): void {
  heading("AgentShield Check");
  console.log(`Risk: ${riskBadge(result.risk)} (${result.score}/100)`);
  console.log(`Allowed: ${result.allowedRiskLevel}`);
  if (!isRiskAllowed(result.risk, result.allowedRiskLevel)) {
    console.log(pc.red("Policy: current risk exceeds allowedRiskLevel."));
  }
  console.log("");

  if (!result.isGitRepo) {
    console.log(pc.yellow("This folder is not a git repository. Run git init to enable diff analysis."));
    return;
  }

  console.log(pc.bold("Affected files:"));
  if (!result.changedFiles.length) {
    console.log("- No changed files detected.");
  } else {
    for (const file of result.changedFiles) {
      const stats = file.additions || file.deletions ? ` +${file.additions}/-${file.deletions}` : "";
      console.log(`- ${file.path} ${pc.dim(`[${file.status}${stats}]`)}`);
    }
  }

  console.log("");
  console.log(pc.bold("Why:"));
  const explanation = explainCheck(result);
  for (const line of explanation) {
    console.log(`- ${line}`);
  }

  console.log("");
  console.log(pc.bold("Suggested action:"));
  if (result.risk === "LOW") {
    console.log("- Continue after reviewing the diff.");
  } else {
    console.log("- Run: agentshield explain");
    if (result.unrelatedFiles.length) {
      console.log("- Run: agentshield revert-unrelated");
    }
  }
}

export function printTasks(tasks: AgentTask[], overlaps: TaskOverlap[]): void {
  heading("AgentShield Tasks");
  if (!tasks.length) {
    console.log("- No tasks found.");
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
    console.log(pc.bold(pc.yellow("Overlap warnings:")));
    for (const overlap of overlaps) {
      console.log(`- ${overlap.firstTaskId} overlaps ${overlap.secondTaskId}: ${overlap.pattern}`);
    }
  }
}

export function printProtectedWarnings(result: CheckResult): void {
  heading("Protected File Warnings");
  if (!result.protectedWarnings.length) {
    console.log("- No protected files changed.");
    return;
  }

  for (const warning of result.protectedWarnings) {
    console.log(`- ${riskBadge(warning.level)} ${warning.file}: ${warning.message}`);
  }
}
