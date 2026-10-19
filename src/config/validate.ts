import { cpuMemoryError } from "./cpu-memory.js";
import { validateInstance, type ValidationResult } from "./schema.js";

export function validateServiceConfig(schema: object, config: unknown): ValidationResult {
  const schemaResult = validateInstance(schema, config);
  const errors = [...schemaResult.errors];
  if (typeof config === "object" && config !== null) {
    const record = config as Record<string, unknown>;
    if ("cpu" in record || "memory" in record) {
      const pairing = cpuMemoryError(record.cpu, record.memory);
      if (pairing) {
        errors.push(pairing);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
