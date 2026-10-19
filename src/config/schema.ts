import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

function formatError(error: ErrorObject): string {
  const at = error.instancePath.length > 0 ? error.instancePath : "/";
  return `${at} ${error.message ?? "invalid"}`;
}

export function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

export function validateInstance(schema: object, data: unknown): ValidationResult {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate: ValidateFunction = ajv.compile(structuredClone(schema));
  const ok = validate(data);
  if (ok === true) {
    return { ok: true, errors: [] };
  }
  return {
    ok: false,
    errors: (validate.errors ?? []).map(formatError),
  };
}
