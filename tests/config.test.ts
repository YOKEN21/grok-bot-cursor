import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { cpuMemoryError, isAllowedCpuMemory } from "../src/config/cpu-memory.js";
import { readJson } from "../src/config/schema.js";
import { validateServiceConfig } from "../src/config/validate.js";
import { repoRoot } from "./helpers.js";

const root = repoRoot();
const schema = readJson(path.join(root, "contracts/service-config.schema.json"));
const fixture = readJson(path.join(root, "tests/fixtures/service-config.json"));

function asSchema(value: unknown): object {
  if (typeof value !== "object" || value === null) {
    throw new Error("schema must be an object");
  }
  return value;
}

function asConfig(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("fixture config must be an object");
  }
  return { ...value };
}

const serviceSchema = asSchema(schema);
const validConfig = asConfig(fixture);

test("a synthetic config that meets the schema and cpu/memory rules is valid", () => {
  const result = validateServiceConfig(serviceSchema, validConfig);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(cpuMemoryError(1024, 2048), undefined);
});

test("rejects a config with a wrong type", () => {
  const wrongEndpoint = { ...validConfig, publicEndpoint: "false" };
  const endpointResult = validateServiceConfig(serviceSchema, wrongEndpoint);
  assert.equal(endpointResult.ok, false);
  assert.match(endpointResult.errors.join("\n"), /publicEndpoint/);

  const wrongCount = { ...validConfig, desiredCount: "3" };
  const countResult = validateServiceConfig(serviceSchema, wrongCount);
  assert.equal(countResult.ok, false);
  assert.match(countResult.errors.join("\n"), /desiredCount/);
});

test("rejects an unknown field", () => {
  const broken = { ...validConfig, region: "us-east-1" };
  const result = validateServiceConfig(serviceSchema, broken);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /additional propert/i);
});

test("rejects a missing field", () => {
  const broken = { ...validConfig };
  delete broken.owner;
  const result = validateServiceConfig(serviceSchema, broken);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /owner/);
});

test("rejects an invalid cpu/memory pair", () => {
  assert.equal(isAllowedCpuMemory(256, 4096), false);
  assert.match(cpuMemoryError(256, 4096) ?? "", /invalid CPU\/memory combination: cpu 256, memory 4096/);
  const broken = { ...validConfig, cpu: 256, memory: 4096 };
  const result = validateServiceConfig(serviceSchema, broken);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /invalid CPU\/memory combination/);
  assert.equal(isAllowedCpuMemory(1024, 1024), false);
  assert.equal(isAllowedCpuMemory(2048, 4096), true);
});

test("desiredCount 3 and 4 are valid while wrong, negative, and fractional counts fail", () => {
  for (const desiredCount of [3, 4]) {
    const result = validateServiceConfig(serviceSchema, { ...validConfig, desiredCount });
    assert.equal(result.ok, true, result.errors.join("\n"));
  }

  const wrongType = validateServiceConfig(serviceSchema, { ...validConfig, desiredCount: "4" });
  assert.equal(wrongType.ok, false);
  assert.match(wrongType.errors.join("\n"), /desiredCount/);

  const negative = validateServiceConfig(serviceSchema, { ...validConfig, desiredCount: -1 });
  assert.equal(negative.ok, false);
  assert.match(negative.errors.join("\n"), /desiredCount/);

  const fractional = validateServiceConfig(serviceSchema, { ...validConfig, desiredCount: 3.5 });
  assert.equal(fractional.ok, false);
  assert.match(fractional.errors.join("\n"), /desiredCount/);
});

test("validate-config accepts the current service file", () => {
  const tsx = path.join(root, "node_modules", ".bin", "tsx");
  const result = spawnSync(tsx, ["src/config/cli.ts"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /config ok/);
});
