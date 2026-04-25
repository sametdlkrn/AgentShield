export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentShieldConfig {
  protectedPaths: string[];
  ignorePaths: string[];
  allowedRiskLevel: RiskLevel;
}

export interface ChangedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  isDeleted: boolean;
}

export interface RiskFinding {
  level: RiskLevel;
  file?: string;
  message: string;
  detail?: string;
}

export interface CheckResult {
  risk: RiskLevel;
  allowedRiskLevel: RiskLevel;
  score: number;
  changedFiles: ChangedFile[];
  findings: RiskFinding[];
  protectedWarnings: RiskFinding[];
  unrelatedFiles: string[];
  isGitRepo: boolean;
}

export interface AgentTask {
  id: string;
  agentName: string;
  scope: string;
  allowedFiles: string[];
  status: "active" | "completed";
  summary: string;
}

export interface TaskOverlap {
  firstTaskId: string;
  secondTaskId: string;
  pattern: string;
}
