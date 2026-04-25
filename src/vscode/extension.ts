import * as vscode from "vscode";
import { loadConfig } from "../config/config";
import { checkChanges } from "../core/risk";
import { scanProject, writeContext } from "../core/projectScanner";
import { detectTaskOverlaps, listTasks } from "../core/tasks";
import { CheckResult, AgentTask, TaskOverlap } from "../core/types";
import { explainCheck } from "../core/explain";

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class AgentShieldViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private result?: CheckResult;
  private tasks: AgentTask[] = [];
  private overlaps: TaskOverlap[] = [];

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "scan") await vscode.commands.executeCommand("agentshield.scanProject");
      if (message.command === "check") await vscode.commands.executeCommand("agentshield.checkChanges");
      if (message.command === "context") await vscode.commands.executeCommand("agentshield.updateContext");
      if (message.command === "explain") await vscode.commands.executeCommand("agentshield.explainRisk");
    });
    this.refresh();
  }

  async load(): Promise<void> {
    const root = workspaceRoot();
    if (!root) {
      this.result = undefined;
      this.tasks = [];
      this.overlaps = [];
      this.refresh("Open a workspace folder to use AgentShield.");
      return;
    }

    const config = await loadConfig(root);
    this.result = await checkChanges(root, config);
    this.tasks = await listTasks(root);
    this.overlaps = detectTaskOverlaps(this.tasks);
    this.refresh();
  }

  refresh(message?: string): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.render(message);
  }

  private render(message?: string): string {
    const result = this.result;
    const risk = result?.risk ?? "LOW";
    const changedFiles = result?.changedFiles ?? [];
    const protectedWarnings = result?.protectedWarnings ?? [];
    const activeTasks = this.tasks.filter((task) => task.status === "active");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { padding: 12px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); }
    h2 { font-size: 14px; margin: 16px 0 8px; }
    .risk { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: 700; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .risk.HIGH, .risk.CRITICAL { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); }
    .risk.MEDIUM { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); }
    button { width: 100%; margin: 4px 0; padding: 7px 8px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 3px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    ul { padding-left: 16px; margin: 6px 0; }
    li { margin: 4px 0; word-break: break-word; }
    .muted { color: var(--vscode-descriptionForeground); }
    .warning { color: var(--vscode-editorWarning-foreground); }
    .empty { color: var(--vscode-descriptionForeground); font-style: italic; }
  </style>
</head>
<body>
  <h1>AgentShield</h1>
  ${message ? `<p class="warning">${escapeHtml(message)}</p>` : ""}
    <div>Current risk: <span class="risk ${risk}">${risk}${result ? ` (${result.score}/100)` : ""}</span></div>
    ${result ? `<div class="muted">Allowed: ${escapeHtml(result.allowedRiskLevel)}</div>` : ""}

  <h2>Actions</h2>
  <button data-command="scan">Scan Project</button>
  <button data-command="check">Check AI Changes</button>
  <button data-command="context">Update Context</button>
  <button data-command="explain">Explain Risk</button>

  <h2>Changed Files</h2>
  ${changedFiles.length ? `<ul>${changedFiles.map((file) => `<li>${escapeHtml(file.path)} <span class="muted">[${escapeHtml(file.status)}]</span></li>`).join("")}</ul>` : `<p class="empty">No changed files detected.</p>`}

  <h2>Protected Warnings</h2>
  ${protectedWarnings.length ? `<ul>${protectedWarnings.map((warning) => `<li class="warning">${escapeHtml(warning.file ?? "")}: ${escapeHtml(warning.message)}</li>`).join("")}</ul>` : `<p class="empty">No protected files changed.</p>`}

  <h2>Active Tasks</h2>
  ${activeTasks.length ? `<ul>${activeTasks.map((task) => `<li><strong>${escapeHtml(task.id)}</strong><br><span class="muted">${escapeHtml(task.scope)}</span></li>`).join("")}</ul>` : `<p class="empty">No active tasks.</p>`}

  ${this.overlaps.length ? `<h2>Overlap Warnings</h2><ul>${this.overlaps.map((overlap) => `<li class="warning">${escapeHtml(overlap.firstTaskId)} overlaps ${escapeHtml(overlap.secondTaskId)}</li>`).join("")}</ul>` : ""}

  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll("button[data-command]").forEach((button) => {
      button.addEventListener("click", () => vscode.postMessage({ command: button.dataset.command }));
    });
  </script>
</body>
</html>`;
  }

  writeExplanation(): void {
    if (!this.result) {
      this.outputChannel.appendLine("No AgentShield result available yet.");
      return;
    }

    this.outputChannel.clear();
    this.outputChannel.appendLine(`AgentShield Risk: ${this.result.risk} (${this.result.score}/100)`);
    this.outputChannel.appendLine("");
    for (const line of explainCheck(this.result)) {
      this.outputChannel.appendLine(`- ${line}`);
    }
    this.outputChannel.show(true);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("AgentShield");
  const provider = new AgentShieldViewProvider(outputChannel);

  context.subscriptions.push(
    outputChannel,
    vscode.window.registerWebviewViewProvider("agentshield.sidebar", provider),
    vscode.commands.registerCommand("agentshield.scanProject", async () => {
      const root = workspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage("Open a workspace folder to scan with AgentShield.");
        return;
      }
      const config = await loadConfig(root);
      await writeContext(root, await scanProject(root, config));
      await provider.load();
      vscode.window.showInformationMessage("AgentShield scan complete.");
    }),
    vscode.commands.registerCommand("agentshield.checkChanges", async () => {
      await provider.load();
      vscode.window.showInformationMessage("AgentShield check complete.");
    }),
    vscode.commands.registerCommand("agentshield.updateContext", async () => {
      const root = workspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage("Open a workspace folder to update AgentShield context.");
        return;
      }
      const config = await loadConfig(root);
      await writeContext(root, await scanProject(root, config));
      await provider.load();
      vscode.window.showInformationMessage("AGENT_CONTEXT.md updated.");
    }),
    vscode.commands.registerCommand("agentshield.explainRisk", async () => {
      await provider.load();
      provider.writeExplanation();
    })
  );
}

export function deactivate(): void {}
