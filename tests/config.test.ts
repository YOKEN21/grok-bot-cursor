import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { cpuMemoryError, isAllowedCpuMemory } from "../src/config/cpu-memory.js";
import { readJson } from "../src/config/schema.js";
import { validateServiceConfig } from "../src/config/validate.js";
import { repoRoot } from "./helpers.js";

const root = repoRoot();
const schema = readJson(path.join(root, "contracts/service-config.schema.json"));
const configPath = path.join(root, "services/matter/matter-search/config.json");
const baseline = readJson(configPath);

function asSchema(value: unknown): object {
  if (typeof value !== "object" || value === null) {
    throw new Error("schema must be an object");
  }
  return value;
}

const serviceSchema = asSchema(schema);

test("baseline config is the approved matter-search dev shape", () => {
  assert.deepEqual(baseline, {
    product: "matter",
    owner: "matter",
    service: "matter-search",
    environment: "dev",
    account: "111111111111",
    cpu: 1024,
    memory: 2048,
    desiredCount: 3,
    publicEndpoint: false,
  });
  assert.deepEqual(Object.keys(baseline as object), [
    "product",
    "owner",
    "service",
    "environment",
    "account",
    "cpu",
    "memory",
    "desiredCount",
    "publicEndpoint",
  ]);
  const result = validateServiceConfig(serviceSchema, baseline);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(cpuMemoryError(1024, 2048), undefined);
});

test("rejects a config with a wrong type", () => {
  const wrongEndpoint = { ...(baseline as Record<string, unknown>), publicEndpoint: "false" };
  const endpointResult = validateServiceConfig(serviceSchema, wrongEndpoint);
  assert.equal(endpointResult.ok, false);
  assert.match(endpointResult.errors.join("\n"), /publicEndpoint/);

  const wrongCount = { ...(baseline as Record<string, unknown>), desiredCount: "3" };
  const countResult = validateServiceConfig(serviceSchema, wrongCount);
  assert.equal(countResult.ok, false);
  assert.match(countResult.errors.join("\n"), /desiredCount/);
});

test("rejects an unknown field", () => {
  const broken = { ...(baseline as Record<string, unknown>), region: "us-east-1" };
  const result = validateServiceConfig(serviceSchema, broken);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /additional propert/i);
});

test("rejects a missing field", () => {
  const broken = { ...(baseline as Record<string, unknown>) };
  delete broken.owner;
  const result = validateServiceConfig(serviceSchema, broken);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /owner/);
});

test("rejects an invalid cpu/memory pair", () => {
  assert.equal(isAllowedCpuMemory(256, 4096), false);
  assert.match(cpuMemoryError(256, 4096) ?? "", /invalid CPU\/memory combination: cpu 256, memory 4096/);
  const broken = { ...(baseline as Record<string, unknown>), cpu: 256, memory: 4096 };
  const result = validateServiceConfig(serviceSchema, broken);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /invalid CPU\/memory combination/);
  assert.equal(isAllowedCpuMemory(1024, 1024), false);
  assert.equal(isAllowedCpuMemory(2048, 4096), true);
});

test("validate-config accepts the baseline file", () => {
  const tsx = path.join(root, "node_modules", ".bin", "tsx");
  const result = spawnSync(tsx, ["src/config/cli.ts"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /config ok/);
  assert.equal(readFileSync(configPath, "utf8").includes('"desiredCount": 3'), true);
});
