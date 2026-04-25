#!/usr/bin/env node
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "fs-extra";
import { Command } from "commander";
import pc from "picocolors";
import simpleGit from "simple-git";
import { loadConfig, writeDefaultConfig } from "../config/config";
import { runAdvancedAnalyzer } from "../core/advancedAnalyzer";
import { scanProject, writeContext } from "../core/projectScanner";
import { checkChanges, isRiskAllowed } from "../core/risk";
import { detectTaskOverlaps, ensureTasksFile, createTask, listTasks, completeTask } from "../core/tasks";
import { getGitChanges } from "../git/gitClient";
import { normalizeRoot } from "../utils/paths";
import {
  formatProblem,
  formatWhyItMatters,
  printCheckResult,
  printNoGitRepo,
  printBanner,
  printAdvancedAnalysis,
  printProtectedWarnings,
  printTasks,
  riskLine,
  heading
} from "./output";

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`AgentShield error: ${message}`));
    process.exitCode = 1;
  }
}

async function initProject(root: string): Promise<void> {
  await writeDefaultConfig(root);
  await ensureTasksFile(root);

  const contextPath = path.join(root, "AGENT_CONTEXT.md");
  if (!(await fs.pathExists(contextPath))) {
    const config = await loadConfig(root);
    await writeContext(root, await scanProject(root, config));
  }

  heading("AgentShield Init");
  console.log("- Created agentshield.config.json if missing.");
  console.log("- Created AGENT_CONTEXT.md if missing.");
  console.log("- Created AGENT_TASKS.md if missing.");
  console.log("");
  console.log(pc.bold("Next action:"));
  console.log("- Run: agentshield scan");
  console.log("- Run: agentshield check");
}

async function scan(root: string): Promise<void> {
  const config = await loadConfig(root);
  const result = await scanProject(root, config);
  await writeContext(root, result);

  heading("AgentShield Scan");
  console.log(`Project: ${root}`);
  console.log(`Tech stack: ${result.techStack.join(", ") || "Unknown"}`);
  console.log(`Protected paths: ${result.protectedFiles.length}`);
  console.log(`Context updated: AGENT_CONTEXT.md`);
}

function serializeCheckResult(result: Awaited<ReturnType<typeof checkChanges>>): string {
  return JSON.stringify({
    risk: result.risk,
    allowedRiskLevel: result.allowedRiskLevel,
    score: result.score,
    isGitRepo: result.isGitRepo,
    changedFiles: result.changedFiles,
    findings: result.findings,
    protectedWarnings: result.protectedWarnings,
    unrelatedFiles: result.unrelatedFiles
  }, null, 2);
}

async function explain(root: string): Promise<void> {
  const result = await checkChanges(root, await loadConfig(root));
  heading("AgentShield Explain");
  console.log("");
  printBanner();
  console.log("");

  if (!result.isGitRepo) {
    printNoGitRepo();
    return;
  }

  console.log(riskLine(result.risk, result.score));
  console.log(`Allowed: ${result.allowedRiskLevel}`);
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
    console.log("- Review the diff, then continue.");
  } else {
    console.log("- Inspect the affected files before committing.");
    console.log("- Run: agentshield check --json");
  }

  if (result.unrelatedFiles.length) {
    console.log("- Run: agentshield revert-unrelated");
  }
  console.log("");
  console.log("AgentShield prevented a potentially dangerous AI change.");
}

async function revertUnrelated(root: string): Promise<void> {
  const result = await checkChanges(root, await loadConfig(root));
  heading("AgentShield Revert Unrelated");

  if (!result.isGitRepo) {
    printNoGitRepo();
    return;
  }

  if (!result.unrelatedFiles.length) {
    console.log("- No unrelated changed files detected.");
    return;
  }

  console.log(pc.bold("Unrelated candidates:"));
  for (const file of result.unrelatedFiles) {
    console.log(`- ${file}`);
  }

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question("\nRevert tracked unrelated files? Type 'yes' to continue: ");
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("No files reverted.");
    return;
  }

  const tracked = result.changedFiles
    .filter((file) => result.unrelatedFiles.includes(file.path) && file.status !== "?")
    .map((file) => file.path);

  if (!tracked.length) {
    console.log("No tracked unrelated files to revert.");
    return;
  }

  await simpleGit(root).raw(["checkout", "--", ...tracked]);
  console.log(`Reverted ${tracked.length} tracked file(s).`);
}

async function analyze(root: string, useAi: boolean): Promise<void> {
  const config = await loadConfig(root);
  const result = await checkChanges(root, config);

  if (!useAi) {
    printCheckResult(result);
    return;
  }

  const gitChanges = await getGitChanges(root);
  if (!gitChanges.isGitRepo) {
    printCheckResult(result);
    return;
  }

  try {
    const advanced = await runAdvancedAnalyzer({
      diffText: gitChanges.diffText,
      changedFiles: result.changedFiles
    });
    printAdvancedAnalysis(advanced);
  } catch {
    console.log("⚠️ Advanced AI analysis not available (Python not installed)");
    console.log("");
    printCheckResult(result);
  }
}

const program = new Command();

program
  .name("agentshield")
  .description("Protect projects from unsafe AI coding agent changes.")
  .version("0.1.0")
  .option("-C, --cwd <path>", "Project root", process.cwd());

program
  .command("init")
  .description("Create AgentShield config, context, and task files")
  .action(() => run(async () => initProject(normalizeRoot(program.opts().cwd))));

program
  .command("scan")
  .description("Scan the repository and update AGENT_CONTEXT.md")
  .action(() => run(async () => scan(normalizeRoot(program.opts().cwd))));

program
  .command("update-context")
  .description("Regenerate AGENT_CONTEXT.md")
  .action(() => run(async () => scan(normalizeRoot(program.opts().cwd))));

program
  .command("check")
  .description("Analyze git diff risk")
  .option("--json", "Print machine-readable JSON")
  .option("--fail-on-risk", "Exit with code 2 when risk exceeds allowedRiskLevel")
  .action((options) => run(async () => {
    const root = normalizeRoot(program.opts().cwd);
    const result = await checkChanges(root, await loadConfig(root));
    if (options.json) {
      console.log(serializeCheckResult(result));
    } else {
      printCheckResult(result);
    }
    if (options.failOnRisk && !isRiskAllowed(result.risk, result.allowedRiskLevel)) {
      process.exitCode = 2;
    }
  }));

program
  .command("analyze")
  .description("Run standard or optional advanced AI analysis")
  .option("--ai", "Enable optional Python-powered advanced analysis")
  .action((options) => run(async () => analyze(normalizeRoot(program.opts().cwd), Boolean(options.ai))));

program
  .command("doctor")
  .description("Check AgentShield local setup")
  .action(() => run(async () => {
    const root = normalizeRoot(program.opts().cwd);
    const config = await loadConfig(root);
    const contextExists = await fs.pathExists(path.join(root, "AGENT_CONTEXT.md"));
    const tasksExists = await fs.pathExists(path.join(root, "AGENT_TASKS.md"));
    const gitRepo = await simpleGit(root).checkIsRepo().catch(() => false);

    heading("AgentShield Doctor");
    console.log(`Project: ${root}`);
    console.log(`Git repository: ${gitRepo ? pc.green("yes") : pc.yellow("no")}`);
    console.log(`Config loaded: ${pc.green("yes")} (${config.protectedPaths.length} protected paths)`);
    console.log(`Context file: ${contextExists ? pc.green("yes") : pc.yellow("missing")}`);
    console.log(`Tasks file: ${tasksExists ? pc.green("yes") : pc.yellow("missing")}`);
    console.log("");
    console.log(pc.bold("Suggested action:"));
    if (!contextExists || !tasksExists) {
      console.log("- Run: agentshield init");
    } else if (!gitRepo) {
      console.log("- Run this inside a git repository to enable diff analysis.");
    } else {
      console.log("- Run: agentshield check --fail-on-risk");
    }
  }));

program
  .command("explain")
  .description("Explain the current risk score")
  .action(() => run(async () => explain(normalizeRoot(program.opts().cwd))));

program
  .command("revert-unrelated")
  .description("Suggest and optionally revert files outside active task scope")
  .action(() => run(async () => revertUnrelated(normalizeRoot(program.opts().cwd))));

const task = program.command("task").description("Manage AgentShield task locks");

task
  .command("create")
  .requiredOption("--agent <name>", "Agent name")
  .requiredOption("--scope <scope>", "Task scope")
  .option("--files <patterns>", "Comma-separated allowed file globs", "**")
  .option("--summary <summary>", "Task summary", "")
  .description("Create an active task")
  .action((options) => run(async () => {
    const root = normalizeRoot(program.opts().cwd);
    const created = await createTask(root, {
      agentName: options.agent,
      scope: options.scope,
      summary: options.summary,
      allowedFiles: String(options.files).split(",").map((item) => item.trim()).filter(Boolean)
    });
    heading("AgentShield Task Created");
    console.log(`Task: ${created.id}`);
    console.log(`Allowed files: ${created.allowedFiles.join(", ")}`);
  }));

task
  .command("list")
  .description("List tasks and overlap warnings")
  .action(() => run(async () => {
    const root = normalizeRoot(program.opts().cwd);
    const tasks = await listTasks(root);
    printTasks(tasks, detectTaskOverlaps(tasks));
  }));

task
  .command("complete")
  .argument("<taskId>", "Task id")
  .description("Mark a task complete")
  .action((taskId) => run(async () => {
    const root = normalizeRoot(program.opts().cwd);
    const found = await completeTask(root, taskId);
    heading("AgentShield Task Complete");
    console.log(found ? `Completed ${taskId}.` : `Task not found: ${taskId}`);
  }));

program
  .command("protected")
  .description("Show protected file warnings for the current diff")
  .action(() => run(async () => {
    const root = normalizeRoot(program.opts().cwd);
    printProtectedWarnings(await checkChanges(root, await loadConfig(root)));
  }));

program.parseAsync(process.argv);
