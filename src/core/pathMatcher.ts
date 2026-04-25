import { toPosixPath } from "../utils/paths";

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern: string): RegExp {
  const normalized = toPosixPath(pattern).replace(/\/+$/g, "");
  let output = "^";

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === "*" && next === "*") {
      output += ".*";
      i += 1;
    } else if (char === "*") {
      output += "[^/]*";
    } else if (char === "?") {
      output += "[^/]";
    } else {
      output += escapeRegex(char);
    }
  }

  output += "$";
  return new RegExp(output);
}

export function matchesPath(filePath: string, pattern: string): boolean {
  const file = toPosixPath(filePath).replace(/\/+$/g, "");
  const normalizedPattern = toPosixPath(pattern).replace(/\/+$/g, "");

  if (!normalizedPattern.includes("*") && !normalizedPattern.includes("?")) {
    return file === normalizedPattern;
  }

  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }

  return globToRegex(normalizedPattern).test(file);
}

export function matchesAnyPath(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPath(filePath, pattern));
}

export function patternsMayOverlap(first: string, second: string): boolean {
  const a = toPosixPath(first).replace(/\/+$/g, "");
  const b = toPosixPath(second).replace(/\/+$/g, "");

  if (a === b || a === "**" || b === "**") {
    return true;
  }

  const aPrefix = a.endsWith("/**") ? a.slice(0, -3) : a.split("*")[0].replace(/\/+$/g, "");
  const bPrefix = b.endsWith("/**") ? b.slice(0, -3) : b.split("*")[0].replace(/\/+$/g, "");

  if (!a.includes("*") && matchesPath(a, b)) {
    return true;
  }

  if (!b.includes("*") && matchesPath(b, a)) {
    return true;
  }

  return Boolean(aPrefix && bPrefix && (aPrefix.startsWith(bPrefix) || bPrefix.startsWith(aPrefix)));
}
