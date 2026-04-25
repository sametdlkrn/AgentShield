import { describe, expect, it } from "vitest";
import { AgentTask } from "./types";
import { detectTaskOverlaps, detectUnrelatedFiles, parseTasks } from "./tasks";

describe("tasks", () => {
  it("parses task markdown", () => {
    const tasks = parseTasks(`### TASK-1
- Agent: codex
- Status: active
- Scope: UI work
- Summary: Build panel
- Allowed Files:
  - src/ui/**
`);

    expect(tasks[0]).toMatchObject({
      id: "TASK-1",
      agentName: "codex",
      status: "active",
      allowedFiles: ["src/ui/**"]
    });
  });

  it("detects unrelated changed files", () => {
    const tasks: AgentTask[] = [
      {
        id: "TASK-1",
        agentName: "agent",
        scope: "UI only",
        allowedFiles: ["src/ui/**"],
        status: "active",
        summary: ""
      }
    ];

    expect(detectUnrelatedFiles(["src/ui/button.ts", "src/auth/session.ts"], tasks)).toEqual(["src/auth/session.ts"]);
  });

  it("detects overlapping active task patterns", () => {
    const tasks: AgentTask[] = [
      {
        id: "TASK-1",
        agentName: "one",
        scope: "auth",
        allowedFiles: ["src/auth/**"],
        status: "active",
        summary: ""
      },
      {
        id: "TASK-2",
        agentName: "two",
        scope: "session",
        allowedFiles: ["src/auth/session.ts"],
        status: "active",
        summary: ""
      }
    ];

    expect(detectTaskOverlaps(tasks)).toHaveLength(1);
  });
});
