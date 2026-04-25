# Security Policy

AgentShield is a local developer safety tool. It does not require a cloud backend or AI API key in the MVP.

## Reporting

Please report security issues privately through GitHub security advisories when available, or open a minimal issue that avoids sensitive details.

## Scope

Security-sensitive areas include:

- command execution,
- file revert behavior,
- protected path matching,
- VS Code extension webview behavior,
- dependency and config analysis.

## Current Guarantees

- `revert-unrelated` asks for confirmation before reverting tracked files.
- Risk checks are deterministic and local.
- No project source code is sent to a remote service by AgentShield.
