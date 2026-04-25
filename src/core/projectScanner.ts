import path from "node:path";
import fs from "fs-extra";
import { AgentShieldConfig } from "./types";
import { relativeProjectPath, shouldSkipPath, toPosixPath } from "../utils/paths";

export interface ProjectScan {
  summary: string;
  techStack: string[];
  folderStructure: string[];
  importantCommands: string[];
  protectedFiles: string[];
}

async function walk(root: string, current: string, files: string[], depth = 0): Promise<void> {
  if (depth > 5) {
    return;
  }

  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = relativeProjectPath(root, absolute);
    if (shouldSkipPath(relative)) {
      continue;
    }

    files.push(relative);
    if (entry.isDirectory()) {
      await walk(root, absolute, files, depth + 1);
    }
  }
}

function formatStructure(paths: string[]): string[] {
  const folders = new Set<string>();
  const files = paths.filter((projectPath) => !projectPath.endsWith("/"));

  for (const projectPath of files) {
    const parts = projectPath.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      folders.add(parts.slice(0, index).join("/") + "/");
    }
  }

  return [...new Set([...folders, ...files])]
    .sort()
    .slice(0, 120);
}

async function readPackage(root: string): Promise<Record<string, unknown> | undefined> {
  const packagePath = path.join(root, "package.json");
  if (!(await fs.pathExists(packagePath))) {
    return undefined;
  }
  return fs.readJson(packagePath);
}

export async function scanProject(root: string, config: AgentShieldConfig): Promise<ProjectScan> {
  const paths: string[] = [];
  await walk(root, root, paths);
  const packageJson = await readPackage(root);

  const techStack = new Set<string>();
  if (packageJson) {
    techStack.add("Node.js");
    if (await fs.pathExists(path.join(root, "tsconfig.json"))) {
      techStack.add("TypeScript");
    }
    const dependencies = {
      ...(packageJson.dependencies as Record<string, string> | undefined),
      ...(packageJson.devDependencies as Record<string, string> | undefined)
    };
    for (const name of ["react", "vue", "svelte", "next", "express", "commander", "vite", "vitest"]) {
      if (dependencies[name]) {
        techStack.add(name);
      }
    }
  }

  const scripts = packageJson?.scripts as Record<string, string> | undefined;
  const importantCommands = scripts
    ? Object.keys(scripts).map((script) => `npm run ${script}`)
    : [];

  const summary = packageJson?.description
    ? String(packageJson.description)
    : "Project summary not set. Update AGENT_CONTEXT.md with product and architecture context.";

  return {
    summary,
    techStack: [...techStack],
    folderStructure: formatStructure(paths.map(toPosixPath)),
    importantCommands,
    protectedFiles: config.protectedPaths
  };
}

export function renderContext(scan: ProjectScan): string {
  const now = new Date().toISOString();
  return `# AgentShield Project Context

## Project Summary
${scan.summary}

## Tech Stack
${scan.techStack.length ? scan.techStack.map((item) => `- ${item}`).join("\n") : "- Unknown"}

## Folder Structure
\`\`\`text
${scan.folderStructure.join("\n") || "(empty)"}
\`\`\`

## Important Commands
${scan.importantCommands.length ? scan.importantCommands.map((item) => `- \`${item}\``).join("\n") : "- No commands detected."}

## Recent Decisions
- No recent decisions recorded.

## Active Tasks
- See AGENT_TASKS.md.

## Protected Files
${scan.protectedFiles.map((item) => `- \`${item}\``).join("\n")}

## Last Scan
${now}
`;
}

export async function writeContext(root: string, scan: ProjectScan): Promise<string> {
  const target = path.join(root, "AGENT_CONTEXT.md");
  await fs.writeFile(target, renderContext(scan), "utf8");
  return target;
}
