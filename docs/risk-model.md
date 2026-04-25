# Risk Model

AgentShield scores the current git diff from `0` to `100` with weighted local signals:

- `.env`: `+70`
- `package.json`: `+50`
- lockfiles: `+20`
- auth/payments paths: `+80`
- config files: `+60`
- large refactor/delete: `+30`

The score is capped at `100` and maps to:

- `LOW`: routine or no risky changes.
- `MEDIUM`: scope drift or moderate risk.
- `HIGH`: sensitive areas, dependency changes, broad edits, or large deletions.
- `CRITICAL`: rare, high-confidence combinations of dangerous AI changes.

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
