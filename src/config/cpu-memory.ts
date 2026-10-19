/**
 * Allowed CPU and memory pairs for a synthetic service config.
 * CPU is in units. Memory is in MiB. Pairs outside this table are invalid.
 */

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(value);
  }
  return values;
}

const MEMORY_BY_CPU: ReadonlyMap<number, readonly number[]> = new Map([
  [256, [512, 1024, 2048]],
  [512, [1024, 2048, 3072, 4096]],
  [1024, [2048, 3072, 4096, 5120, 6144, 7168, 8192]],
  [2048, range(4096, 16384, 1024)],
  [4096, range(8192, 30720, 1024)],
]);

export function isAllowedCpuMemory(cpu: number, memory: number): boolean {
  const allowed = MEMORY_BY_CPU.get(cpu);
  return allowed !== undefined && allowed.includes(memory);
}

export function cpuMemoryError(cpu: unknown, memory: unknown): string | undefined {
  if (typeof cpu !== "number" || typeof memory !== "number" || !Number.isInteger(cpu) || !Number.isInteger(memory)) {
    return "cpu and memory must be integers";
  }
  if (!isAllowedCpuMemory(cpu, memory)) {
    return `invalid CPU/memory combination: cpu ${cpu}, memory ${memory}`;
  }
  return undefined;
}
