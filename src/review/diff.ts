export const MAX_DIFF_CHARS = 80_000;

const DIFF_GIT = /^diff --git a\/(\S+) b\/(\S+)$/;

export type CollectedDiff = {
  files: string[];
  text: string;
  truncated: boolean;
};

export function changedFiles(diff: string): string[] {
  const files: string[] = [];
  for (const line of diff.split("\n")) {
    const match = DIFF_GIT.exec(line);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    const file = match[2] === "/dev/null" ? match[1] : match[2];
    if (file !== "/dev/null") {
      files.push(file);
    }
  }
  return files;
}

export function collectDiff(diff: string): CollectedDiff {
  const truncated = diff.length > MAX_DIFF_CHARS;
  return {
    files: changedFiles(diff),
    text: truncated ? diff.slice(0, MAX_DIFF_CHARS) : diff,
    truncated,
  };
}
