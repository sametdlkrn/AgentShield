import path from "node:path";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".vscode-test"
]);

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function relativeProjectPath(root: string, filePath: string): string {
  return toPosixPath(path.relative(root, filePath));
}

export function shouldSkipPath(projectPath: string): boolean {
  const parts = toPosixPath(projectPath).split("/");
  return parts.some((part) => ignoredDirectories.has(part));
}

export function normalizeRoot(root?: string): string {
  return path.resolve(root ?? process.cwd());
}
