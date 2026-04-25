import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { loadConfig, writeDefaultConfig } from "./config";

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "agentshield-config-"));
}

describe("config loading", () => {
  it("returns defaults when config is missing", async () => {
    const root = await tempDir();
    const config = await loadConfig(root);
    expect(config.allowedRiskLevel).toBe("MEDIUM");
    expect(config.protectedPaths).toContain("package.json");
    expect(config.ignorePaths).toContain("node_modules/**");
  });

  it("loads a valid config file", async () => {
    const root = await tempDir();
    await fs.writeJson(path.join(root, "agentshield.config.json"), {
      protectedPaths: ["src/auth/**"],
      allowedRiskLevel: "HIGH"
    });

    const config = await loadConfig(root);
    expect(config.protectedPaths).toEqual(["src/auth/**"]);
    expect(config.allowedRiskLevel).toBe("HIGH");
    expect(config.ignorePaths).toContain("node_modules/**");
  });

  it("writes the default config", async () => {
    const root = await tempDir();
    const file = await writeDefaultConfig(root);
    expect(await fs.pathExists(file)).toBe(true);
  });
});
