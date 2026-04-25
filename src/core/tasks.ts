import path from "node:path";
import fs from "fs-extra";
import { AgentTask, TaskOverlap } from "./types";
import { matchesAnyPath, patternsMayOverlap } from "./pathMatcher";

export const TASKS_FILE = "AGENT_TASKS.md";
const START = "<!-- AGENTSHIELD_TASKS_START -->";
const END = "<!-- AGENTSHIELD_TASKS_END -->";

export async function ensureTasksFile(root: string): Promise<string> {
  const target = path.join(root, TASKS_FILE);
  if (!(await fs.pathExists(target))) {
    await fs.writeFile(target, `# AgentShield Tasks

Tasks define what each AI coding agent is allowed to touch.

## Tasks

${START}
${END}
`, "utf8");
  }
  return target;
}

function taskToMarkdown(task: AgentTask): string {
  const allowedFiles = task.allowedFiles.map((item) => `  - ${item}`).join("\n");
  return `### ${task.id}
- Agent: ${task.agentName}
- Status: ${task.status}
- Scope: ${task.scope}
- Summary: ${task.summary}
- Allowed Files:
${allowedFiles || "  - (none)"}
`;
}

export function parseTasks(markdown: string): AgentTask[] {
  const taskBlocks = markdown.split(/^### /m).slice(1);
  return taskBlocks.map((block) => {
    const lines = block.trim().split(/\r?\n/);
    const id = lines[0].trim();
    const field = (name: string) => {
      const prefix = `- ${name}:`;
      return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
    };
    const allowedIndex = lines.findIndex((line) => line.startsWith("- Allowed Files:"));
    const allowedFiles = allowedIndex === -1
      ? []
      : lines
        .slice(allowedIndex + 1)
        .filter((line) => line.trim().startsWith("- "))
        .map((line) => line.trim().slice(2).trim())
        .filter((line) => line && line !== "(none)");

    const status = field("Status") === "completed" ? "completed" : "active";
    return {
      id,
      agentName: field("Agent") || "unknown",
      status,
      scope: field("Scope") || "(none)",
      summary: field("Summary") || "",
      allowedFiles
    };
  });
}

async function readTasksMarkdown(root: string): Promise<string> {
  await ensureTasksFile(root);
  return fs.readFile(path.join(root, TASKS_FILE), "utf8");
}

export async function listTasks(root: string): Promise<AgentTask[]> {
  return parseTasks(await readTasksMarkdown(root));
}

export async function createTask(root: string, input: Omit<AgentTask, "id" | "status">): Promise<AgentTask> {
  const markdown = await readTasksMarkdown(root);
  const task: AgentTask = {
    ...input,
    id: `TASK-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    status: "active"
  };
  const rendered = taskToMarkdown(task);

  const updated = markdown.includes(START) && markdown.includes(END)
    ? markdown.replace(END, `${rendered}\n${END}`)
    : `${markdown.trim()}\n\n${rendered}`;

  await fs.writeFile(path.join(root, TASKS_FILE), updated, "utf8");
  return task;
}

export async function completeTask(root: string, taskId: string): Promise<boolean> {
  const markdown = await readTasksMarkdown(root);
  const tasks = parseTasks(markdown);
  let found = false;
  const rendered = tasks.map((task) => {
    if (task.id === taskId) {
      found = true;
      return taskToMarkdown({ ...task, status: "completed" });
    }
    return taskToMarkdown(task);
  }).join("\n");

  const updated = markdown.includes(START) && markdown.includes(END)
    ? markdown.replace(new RegExp(`${START}[\\s\\S]*${END}`), `${START}\n${rendered}\n${END}`)
    : rendered;

  await fs.writeFile(path.join(root, TASKS_FILE), updated, "utf8");
  return found;
}

export function detectTaskOverlaps(tasks: AgentTask[]): TaskOverlap[] {
  const active = tasks.filter((task) => task.status === "active");
  const overlaps: TaskOverlap[] = [];

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      for (const firstPattern of active[i].allowedFiles) {
        const matched = active[j].allowedFiles.find((secondPattern) => patternsMayOverlap(firstPattern, secondPattern));
        if (matched) {
          overlaps.push({
            firstTaskId: active[i].id,
            secondTaskId: active[j].id,
            pattern: `${firstPattern} <> ${matched}`
          });
        }
      }
    }
  }

  return overlaps;
}

export function detectUnrelatedFiles(changedFiles: string[], activeTasks: AgentTask[]): string[] {
  const active = activeTasks.filter((task) => task.status === "active");
  if (!active.length) {
    return [];
  }

  const allowedPatterns = active.flatMap((task) => task.allowedFiles);
  if (!allowedPatterns.length) {
    return changedFiles;
  }

  return changedFiles.filter((file) => !matchesAnyPath(file, allowedPatterns));
}
