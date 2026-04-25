# AgentShield

**Your AI writes code. AgentShield makes sure it does not destroy your project.**

AgentShield is a local-first CLI and VS Code extension that reviews AI coding agent changes before they become commits. It detects risky edits, protected file changes, unrelated work, dependency/config drift, and multi-agent task overlap using deterministic rules. No cloud backend. No payment flow. No AI API key.

[![CI](https://github.com/sametdlkrn/AgentShield/actions/workflows/ci.yml/badge.svg)](https://github.com/sametdlkrn/AgentShield/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](package.json)

## Why This Exists

AI coding agents are fast, but they can also:

- edit files outside the requested task,
- rewrite auth, payment, or security code,
- change dependencies without explaining why,
- delete important logic,
- drift across multiple agents working in the same repo.

AgentShield gives developers a lightweight guardrail before code reaches pull requests.

## Core Features

- **Project Context Engine**: creates and updates `AGENT_CONTEXT.md`.
- **AI Change Safety Layer**: scores current git changes as `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
- **Protected File System**: warns when configured sensitive paths change.
- **Unrelated Change Detection**: compares changed files with active task scope.
- **Multi-Agent Task Locking**: tracks agent scopes in `AGENT_TASKS.md`.
- **VS Code Sidebar**: shows risk, changed files, protected warnings, and active tasks.
- **CI-Friendly CLI**: supports JSON output and fail-on-risk policy checks.

## Install

```bash
npm install
npm run build
npm link
```

Initialize a repository:

```bash
agentshield init
agentshield scan
agentshield check
```

## Quick Demo

```bash
agentshield task create \
  --agent codex \
  --scope "Build settings UI" \
  --files "src/ui/**,src/vscode/**" \
  --summary "Keep this agent away from auth and payments"

agentshield check
agentshield explain
```

Example output:

```text
AgentShield Check
Risk: HIGH (70/100)
Allowed: MEDIUM
Policy: current risk exceeds allowedRiskLevel.

Affected files:
- src/auth/session.ts [M +12/-2]
- package.json [M +1/-1]

Why:
- src/auth/session.ts: Sensitive auth/payment/security area changed
- package.json: Package or dependency file changed

Suggested action:
- Run: agentshield explain
- Run: agentshield revert-unrelated
```

## CLI Commands

```bash
agentshield init
agentshield scan
agentshield update-context
agentshield check
agentshield check --json
agentshield check --fail-on-risk
agentshield explain
agentshield revert-unrelated
agentshield doctor
agentshield task create --agent codex --scope "UI sidebar" --files "src/ui/**,src/vscode/**"
agentshield task list
agentshield task complete TASK-20260425120000
```

## Configuration

`agentshield.config.json`:

```json
{
  "protectedPaths": [
    ".env",
    "package.json",
    "src/auth/**",
    "src/payments/**",
    "firebase.rules"
  ],
  "allowedRiskLevel": "MEDIUM"
}
```

## VS Code Extension

Build and install locally:

```bash
npm run vscode:install
```

Open VS Code, select the AgentShield shield icon in the activity bar, and use:

- Scan Project
- Check AI Changes
- Update Context
- Explain Risk

During development, open this folder in VS Code and press `F5` to launch an Extension Development Host.

## CI Usage

Add AgentShield to a repository and fail builds when agent changes exceed policy:

```bash
agentshield check --fail-on-risk
```

For automation and dashboards:

```bash
agentshield check --json
```

## Architecture

```text
src/
  cli/       commander CLI and premium terminal output
  config/    zod config loading and defaults
  core/      risk model, context scanner, task locking
  git/       simple-git change collection
  utils/     path normalization helpers
  vscode/    VS Code webview sidebar
```

More detail:

- [Architecture](docs/architecture.md)
- [Risk model](docs/risk-model.md)
- [Roadmap](docs/roadmap.md)

## Positioning

AgentShield is the local safety layer for teams adopting AI coding agents. It helps developers and engineering managers review agent output, enforce task scope, protect sensitive files, and reduce accidental regressions before code reaches pull requests.

Future paid tiers can add team policies, hosted dashboards, audit history, pull request checks, and cloud sync. The MVP intentionally stays local-first so the core trust model is simple and fast.

## Development

```bash
npm install
npm run build
npm test
npm run check
```

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and keep changes scoped, deterministic, and easy to review.

## License

MIT
