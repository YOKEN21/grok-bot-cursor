import path from "node:path";

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";
  let index = 0;
  while (index < pattern.length) {
    if (pattern.startsWith("**/", index)) {
      source += "(?:.*/)?";
      index += 3;
      continue;
    }
    if (pattern.startsWith("**", index)) {
      source += ".*";
      index += 2;
      continue;
    }
    const char = pattern[index] ?? "";
    if (char === "*") {
      source += "[^/]*";
    } else if ("\\^$+?.()|{}[]".includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
    index += 1;
  }
  source += "$";
  return new RegExp(source);
}

export function pathAllowed(filePath: string, allowedPaths: readonly string[]): boolean {
  const normalized = toPosix(filePath).replace(/^\.\//, "");
  for (const entry of allowedPaths) {
    const pattern = toPosix(entry).trim().replace(/^\.\//, "");
    if (pattern.length === 0) {
      continue;
    }
    if (pattern.endsWith("/")) {
      if (normalized.startsWith(pattern)) {
        return true;
      }
      continue;
    }
    if (pattern.includes("*")) {
      if (globToRegExp(pattern).test(normalized)) {
        return true;
      }
      continue;
    }
    if (pattern === normalized) {
      return true;
    }
  }
  return false;
}

/** An empty allow-list matches nothing. */
export function filesOutsideAllowedPaths(
  changedFiles: readonly string[],
  allowedPaths: readonly string[],
): string[] {
  return changedFiles.map(toPosix).filter((file) => !pathAllowed(file, allowedPaths));
}
