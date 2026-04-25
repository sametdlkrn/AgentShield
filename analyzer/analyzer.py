#!/usr/bin/env python3
"""Optional advanced analyzer for AgentShield.

Reads a diff payload from a JSON file argument or stdin and prints JSON.
This module intentionally has no external dependencies.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def risk_from_score(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def add_reason(reasons: list[str], reason: str) -> None:
    if reason not in reasons:
        reasons.append(reason)


def read_payload() -> dict[str, Any]:
    if len(sys.argv) > 1:
        raw = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        raw = sys.stdin.read()

    if not raw.strip():
        return {"diffText": "", "changedFiles": []}

    try:
        payload = json.loads(raw)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    return {"diffText": raw, "changedFiles": []}


def changed_paths(payload: dict[str, Any]) -> list[str]:
    files = payload.get("changedFiles", [])
    paths: list[str] = []

    if isinstance(files, list):
        for item in files:
            if isinstance(item, dict) and isinstance(item.get("path"), str):
                paths.append(item["path"])
            elif isinstance(item, str):
                paths.append(item)

    diff_text = str(payload.get("diffText", ""))
    for match in re.finditer(r"^diff --git a/(.*?) b/(.*?)$", diff_text, re.MULTILINE):
        paths.append(match.group(2))

    return sorted(set(paths))


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    score = 0
    reasons: list[str] = []

    for path in changed_paths(payload):
        normalized = path.replace("\\", "/")

        if re.search(r"(^|/)\.env($|\.)", normalized):
            score += 90
            add_reason(reasons, "Protected environment file changed")
            add_reason(reasons, "Potential secrets or deployment impact")

        if normalized.endswith("package.json"):
            score += 75
            add_reason(reasons, "Dependency change detected")
            add_reason(reasons, "Potential security impact")

        if re.search(r"(^|/)(auth|payment|payments)(/|\.|$)", normalized):
            score += 75
            add_reason(reasons, "Auth or payment code changed")
            add_reason(reasons, "Potential security impact")

    score = min(score, 100)
    if not reasons:
        add_reason(reasons, "No advanced AI risk pattern detected")

    return {
        "risk": risk_from_score(score),
        "score": score,
        "reasons": reasons,
    }


def main() -> int:
    print(json.dumps(analyze(read_payload()), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
