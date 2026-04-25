import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import fs from "fs-extra";
import { ChangedFile, RiskLevel } from "./types";

const execFileAsync = promisify(execFile);

export interface AdvancedAnalysisResult {
  risk: RiskLevel;
  score: number;
  reasons: string[];
}

export interface DiffPayload {
  diffText: string;
  changedFiles: ChangedFile[];
}

function analyzerPath(): string {
  return path.resolve(__dirname, "../../analyzer/analyzer.py");
}

function parseAdvancedResult(raw: string): AdvancedAnalysisResult {
  const parsed = JSON.parse(raw) as Partial<AdvancedAnalysisResult>;
  const risk = parsed.risk;
  if (!risk || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risk)) {
    throw new Error("Analyzer returned an invalid risk level.");
  }

  return {
    risk,
    score: typeof parsed.score === "number" ? parsed.score : 0,
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : []
  };
}

export async function runAdvancedAnalyzer(payload: DiffPayload): Promise<AdvancedAnalysisResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentshield-"));
  const diffPath = path.join(tempDir, "diff.json");

  try {
    await fs.writeJson(diffPath, payload, { spaces: 2 });
    const { stdout } = await execFileAsync("python", [analyzerPath(), diffPath], {
      cwd: path.resolve(__dirname, "../.."),
      windowsHide: true,
      timeout: 15_000
    });
    return parseAdvancedResult(stdout);
  } finally {
    await fs.remove(tempDir).catch(() => undefined);
  }
}
