import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import { AgentShieldConfig, RiskLevel } from "../core/types";

export const CONFIG_FILE = "agentshield.config.json";

const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const configSchema = z.object({
  protectedPaths: z.array(z.string()).default([]),
  allowedRiskLevel: riskLevelSchema.default("MEDIUM")
});

export const defaultConfig: AgentShieldConfig = {
  protectedPaths: [".env", "package.json", "src/auth/**", "src/payments/**", "firebase.rules"],
  allowedRiskLevel: "MEDIUM"
};

export function parseRiskLevel(value: string): RiskLevel {
  return riskLevelSchema.parse(value.toUpperCase());
}

export async function loadConfig(root: string): Promise<AgentShieldConfig> {
  const configPath = path.join(root, CONFIG_FILE);

  if (!(await fs.pathExists(configPath))) {
    return defaultConfig;
  }

  const raw = await fs.readJson(configPath);
  return configSchema.parse(raw);
}

export async function writeDefaultConfig(root: string): Promise<string> {
  const target = path.join(root, CONFIG_FILE);
  if (!(await fs.pathExists(target))) {
    await fs.writeJson(target, defaultConfig, { spaces: 2 });
  }
  return target;
}
