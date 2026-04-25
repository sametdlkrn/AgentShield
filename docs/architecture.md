# Architecture

AgentShield is intentionally local-first. The CLI, VS Code extension, and tests share the same deterministic core modules.

## Layers

- `src/cli`: command parsing, terminal output, and exit-code behavior.
- `src/vscode`: VS Code webview sidebar and command registration.
- `src/core`: risk scoring, task locking, path matching, context generation, and explanations.
- `src/git`: git change collection through `simple-git`.
- `src/config`: `agentshield.config.json` loading and validation through `zod`.
- `src/utils`: path normalization and shared filesystem helpers.

## Data Files

- `agentshield.config.json`: protected paths and allowed risk policy.
- `AGENT_CONTEXT.md`: repository context for AI coding agents.
- `AGENT_TASKS.md`: active agent scopes and allowed files.

## Design Principles

- Deterministic checks before AI analysis.
- No cloud dependency in the MVP.
- One risk model shared by CLI and VS Code.
- Explicit confirmation before reverting unrelated changes.
- Modular core so SaaS sync and hosted policy enforcement can be added later.
