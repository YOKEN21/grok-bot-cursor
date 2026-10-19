export const MAX_DIFF_CHARS = 80_000;

export type CollectedDiff = {
  files: string[];
  text: string;
  truncated: boolean;
  unparsedHeaders: string[];
};

type ParsedHeader = {
  source: string | null;
  destination: string | null;
};

function unquoteGitPath(token: string): string | null {
  if (token.length < 2 || !token.startsWith('"') || !token.endsWith('"')) {
    return null;
  }
  const inner = token.slice(1, -1);
  const bytes: number[] = [];
  const flush = (parts: string[]): void => {
    if (bytes.length === 0) {
      return;
    }
    parts.push(Buffer.from(bytes).toString("utf8"));
    bytes.length = 0;
  };
  const parts: string[] = [];
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char !== "\\") {
      flush(parts);
      parts.push(char ?? "");
      continue;
    }
    const next = inner[index + 1];
    if (next === undefined) {
      return null;
    }
    index += 1;
    if (next === "\\" || next === '"') {
      flush(parts);
      parts.push(next);
      continue;
    }
    if (next === "n") {
      flush(parts);
      parts.push("\n");
      continue;
    }
    if (next === "t") {
      flush(parts);
      parts.push("\t");
      continue;
    }
    if (next === "r") {
      flush(parts);
      parts.push("\r");
      continue;
    }
    if (next >= "0" && next <= "7") {
      let octal = next;
      for (let extra = 0; extra < 2; extra += 1) {
        const digit = inner[index + 1];
        if (digit === undefined || digit < "0" || digit > "7") {
          break;
        }
        octal += digit;
        index += 1;
      }
      bytes.push(Number.parseInt(octal, 8));
      continue;
    }
    return null;
  }
  flush(parts);
  return parts.join("");
}

function takeQuoted(input: string): { path: string; consumed: number } | null {
  if (!input.startsWith('"')) {
    return null;
  }
  let escaped = false;
  for (let index = 1; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      const path = unquoteGitPath(input.slice(0, index + 1));
      if (path === null) {
        return null;
      }
      return { path, consumed: index + 1 };
    }
  }
  return null;
}

function repoPath(token: string, side: "a" | "b"): string | null | undefined {
  if (token === "/dev/null") {
    return null;
  }
  const prefix = `${side}/`;
  if (!token.startsWith(prefix)) {
    return undefined;
  }
  const relative = token.slice(prefix.length);
  if (relative.length === 0) {
    return undefined;
  }
  if (relative === "/dev/null") {
    return null;
  }
  return relative;
}

function parseQuotedHeader(rest: string): ParsedHeader | null {
  const first = takeQuoted(rest);
  if (!first || !rest.startsWith(" ", first.consumed)) {
    return null;
  }
  const second = takeQuoted(rest.slice(first.consumed + 1));
  if (!second || first.consumed + 1 + second.consumed !== rest.length) {
    return null;
  }
  const source = repoPath(first.path, "a");
  const destination = repoPath(second.path, "b");
  if (source === undefined || destination === undefined || (source === null && destination === null)) {
    return null;
  }
  return { source, destination };
}

function parsePlainHeader(rest: string): ParsedHeader | null {
  if (!rest.startsWith("a/")) {
    return null;
  }
  const splits: number[] = [];
  let from = 0;
  while (from < rest.length) {
    const at = rest.indexOf(" b/", from);
    if (at < 0) {
      break;
    }
    splits.push(at);
    from = at + 3;
  }
  if (splits.length !== 1) {
    return null;
  }
  const split = splits[0] ?? 0;
  const source = repoPath(rest.slice(0, split), "a");
  const destination = repoPath(rest.slice(split + 1), "b");
  if (source === undefined || destination === undefined || (source === null && destination === null)) {
    return null;
  }
  return { source, destination };
}

function parseDiffGitHeader(line: string): ParsedHeader | null {
  const prefix = "diff --git ";
  if (!line.startsWith(prefix)) {
    return null;
  }
  const rest = line.slice(prefix.length);
  if (rest.startsWith('"')) {
    return parseQuotedHeader(rest);
  }
  return parsePlainHeader(rest);
}

export function inspectDiff(diff: string): { files: string[]; unparsedHeaders: string[] } {
  const files: string[] = [];
  const unparsedHeaders: string[] = [];
  for (const rawLine of diff.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line.startsWith("diff --git ")) {
      continue;
    }
    const parsed = parseDiffGitHeader(line);
    if (!parsed) {
      unparsedHeaders.push(line);
      continue;
    }
    for (const file of [parsed.source, parsed.destination]) {
      if (file && !files.includes(file)) {
        files.push(file);
      }
    }
  }
  return { files, unparsedHeaders };
}

export function changedFiles(diff: string): string[] {
  return inspectDiff(diff).files;
}

export function collectDiff(diff: string): CollectedDiff {
  const parsed = inspectDiff(diff);
  const truncated = diff.length > MAX_DIFF_CHARS;
  return {
    files: parsed.files,
    unparsedHeaders: parsed.unparsedHeaders,
    text: truncated ? diff.slice(0, MAX_DIFF_CHARS) : diff,
    truncated,
  };
}
