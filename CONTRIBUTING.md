# Contributing

AgentShield should stay fast, deterministic, and easy to run locally.

## Development

```bash
npm install
npm run build
npm test
npm run check
```

## Guidelines

- Keep changes scoped and modular.
- Prefer deterministic checks over AI-dependent behavior.
- Add tests for risk scoring, path matching, task logic, and config behavior.
- Do not add a cloud dependency to the local MVP path.
- Keep CLI output clean and actionable.

## Pull Requests

Good pull requests include:

- a clear summary,
- tests for behavior changes,
- updated docs when commands or config change,
- screenshots for VS Code UI changes when practical.
