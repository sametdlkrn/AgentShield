import simpleGit from "simple-git";
import { ChangedFile } from "../core/types";
import { toPosixPath } from "../utils/paths";

export interface GitChangeSet {
  isGitRepo: boolean;
  changedFiles: ChangedFile[];
  diffText: string;
}

function normalizeStatus(index: string, workingTree: string): string {
  const value = `${index}${workingTree}`.trim();
  return value || "M";
}

export async function getGitChanges(root: string): Promise<GitChangeSet> {
  const git = simpleGit(root);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return { isGitRepo: false, changedFiles: [], diffText: "" };
    }

    const [status, unstagedSummary, stagedSummary, diffText, stagedDiffText] = await Promise.all([
      git.status(),
      git.diffSummary(),
      git.diffSummary(["--cached"]),
      git.diff(),
      git.diff(["--cached"])
    ]);

    const statByFile = new Map<string, { additions: number; deletions: number }>();
    for (const file of [...unstagedSummary.files, ...stagedSummary.files]) {
      const key = toPosixPath(file.file);
      const existing = statByFile.get(key) ?? { additions: 0, deletions: 0 };
      existing.additions += "insertions" in file ? file.insertions : 0;
      existing.deletions += "deletions" in file ? file.deletions : 0;
      statByFile.set(key, existing);
    }

    const changedFiles = status.files.map((file) => {
      const projectPath = toPosixPath(file.path);
      const stats = statByFile.get(projectPath) ?? { additions: 0, deletions: 0 };
      const statusCode = normalizeStatus(file.index, file.working_dir);
      return {
        path: projectPath,
        status: statusCode,
        additions: stats.additions,
        deletions: stats.deletions,
        isDeleted: statusCode.includes("D")
      };
    });

    return {
      isGitRepo: true,
      changedFiles,
      diffText: [stagedDiffText, diffText].filter(Boolean).join("\n")
    };
  } catch {
    return { isGitRepo: false, changedFiles: [], diffText: "" };
  }
}
