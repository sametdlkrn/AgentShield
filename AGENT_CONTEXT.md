# AgentShield Project Context

## Project Summary
A local AI developer safety tool for guarding projects from unsafe agent changes.

## Tech Stack
- Node.js
- TypeScript
- commander
- vitest

## Folder Structure
```text
.gitattributes
.github
.github/
.github/ISSUE_TEMPLATE
.github/ISSUE_TEMPLATE/
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
.github/pull_request_template.md
.github/workflows
.github/workflows/
.github/workflows/ci.yml
.gitignore
.vscodeignore
AGENT_CONTEXT.md
AGENT_TASKS.md
CHANGELOG.md
CONTRIBUTING.md
LICENSE
README.md
SECURITY.md
agentshield-0.1.0.vsix
agentshield.config.example.json
agentshield.config.json
docs
docs/
docs/architecture.md
docs/output.png
docs/risk-model.md
docs/roadmap.md
docs/vscode.png
package-lock.json
package.json
resources
resources/
resources/shield.svg
src
src/
src/cli
src/cli.ts
src/cli/
src/cli/index.ts
src/cli/output.ts
src/config
src/config/
src/config/config.test.ts
src/config/config.ts
src/core
src/core/
src/core/explain.ts
src/core/pathMatcher.test.ts
src/core/pathMatcher.ts
src/core/projectScanner.ts
src/core/risk.test.ts
src/core/risk.ts
src/core/tasks.test.ts
src/core/tasks.ts
src/core/types.ts
src/git
src/git/
src/git/gitClient.ts
src/utils
src/utils/
src/utils/paths.ts
src/vscode
src/vscode/
src/vscode/extension.ts
templates
templates/
templates/AGENT_CONTEXT.md
templates/AGENT_TASKS.md
templates/agentshield.config.json
tsconfig.json
vitest.config.ts
```

## Important Commands
- `npm run build`
- `npm run prepare`
- `npm run test`
- `npm run check`
- `npm run audit:runtime`
- `npm run vscode:package`
- `npm run vscode:install`

## Recent Decisions
- No recent decisions recorded.

## Active Tasks
- See AGENT_TASKS.md.

## Protected Files
- `.env`
- `package.json`
- `src/auth/**`
- `src/payments/**`
- `firebase.rules`

## Last Scan
2026-04-25T16:34:14.021Z
