# Risk Model

AgentShield scores the current git diff from `0` to `100` and maps it to:

- `LOW`: routine or no risky changes.
- `MEDIUM`: scope drift or moderate risk.
- `HIGH`: sensitive areas, dependency changes, broad edits, or large deletions.
- `CRITICAL`: protected secrets/config changes or destructive file deletions.

## Signals

- Protected path changed.
- Auth, payment, security, session, token, permission, or ACL path changed.
- Package or lockfile changed.
- Environment, deployment, or config file changed.
- File deletion or large deletion.
- Large unexplained refactor candidate.
- Changed file outside active task scope.
- Broad change set across many files.

## Policy

`allowedRiskLevel` controls what is acceptable locally and in CI:

```bash
agentshield check --fail-on-risk
```

If the current risk exceeds policy, the command exits with code `2`.
